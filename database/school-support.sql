-- School support API is mediated by school-support Edge Function.
-- No public table reads: an unguessable per-ticket secret protects anonymous school access.
create table public.support_tickets (
 id uuid primary key,
 number bigint generated always as identity unique,
 access_hash text not null unique check (length(access_hash)=64),
 school_id uuid not null references public.schools(id),
 reporter_name text not null check (length(reporter_name) between 2 and 120),
 phone text not null check (phone ~ '^9665[0-9]{8}$'),
 service text not null check (service in ('استيراد الطلاب','إصدار PDF','طباعة النماذج','أخرى')),
 kind text not null check (kind in ('مشكلة تقنية','مشكلة بيانات','استفسار','اقتراح')),
 title text not null check (length(title) between 5 and 160),
 status text not null default 'new' check (status in ('new','in_progress','waiting_school','resolved','closed')),
 priority text not null default 'normal' check (priority in ('normal','high','urgent')),
 resolution text not null default '' check (length(resolution)<=6000),
 rating int check (rating between 1 and 5),
 client_hash text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index support_tickets_school_updated on public.support_tickets(school_id,updated_at desc);
create index support_tickets_status_updated on public.support_tickets(status,updated_at desc);
create index support_tickets_client_created on public.support_tickets(client_hash,created_at desc);
create table public.support_messages (
 id uuid primary key,
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_role text not null check (author_role in ('school','admin')),
 actor_id uuid references auth.users(id) on delete set null,
 internal boolean not null default false,
 body text not null check (length(body) between 1 and 6000),
 attachment_path text,
 attachment_name text,
 attachment_mime text,
 status_change text,
 created_at timestamptz not null default now(),
 check (not internal or author_role='admin')
);
create index support_messages_ticket_created on public.support_messages(ticket_id,created_at);
create index support_messages_actor on public.support_messages(actor_id) where actor_id is not null;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from anon, authenticated;
grant all on public.support_tickets, public.support_messages to service_role;
grant usage,select on sequence public.support_tickets_number_seq to service_role;
-- Deny-by-default policies document the edge-only access model.
create policy "support edge only" on public.support_tickets for all to anon,authenticated using(false) with check(false);
create policy "support messages edge only" on public.support_messages for all to anon,authenticated using(false) with check(false);

create function public.support_open_ticket(p_ticket jsonb,p_message jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare existing public.support_tickets; ticket uuid := (p_ticket->>'id')::uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_ticket->>'client_hash',1));
 select * into existing from public.support_tickets where id=ticket;
 if found then
   if existing.access_hash <> p_ticket->>'access_hash' then raise exception 'invalid_request'; end if;
   return ticket;
 end if;
 if (select count(*) from public.support_tickets where client_hash=p_ticket->>'client_hash' and created_at>now()-interval '1 hour')>=10
 then raise exception 'rate_limit'; end if;
 insert into public.support_tickets(id,access_hash,school_id,reporter_name,phone,service,kind,title,client_hash)
 values(ticket,p_ticket->>'access_hash',(p_ticket->>'school_id')::uuid,p_ticket->>'reporter_name',p_ticket->>'phone',p_ticket->>'service',p_ticket->>'kind',p_ticket->>'title',p_ticket->>'client_hash');
 insert into public.support_messages(id,ticket_id,author_role,body,attachment_path,attachment_name,attachment_mime)
 values((p_message->>'id')::uuid,ticket,'school',p_message->>'body',p_message->>'attachment_path',p_message->>'attachment_name',p_message->>'attachment_mime');
 return ticket;
end $$;

create function public.support_append_message(p_ticket uuid,p_message jsonb,p_admin boolean,
 p_status text default null,p_priority text default null,p_resolution text default null,p_rating int default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare t public.support_tickets; next_status text; msg uuid := (p_message->>'id')::uuid;
begin
 select * into t from public.support_tickets where id=p_ticket for update;
 if not found then raise exception 'not_found'; end if;
 if exists(select 1 from public.support_messages where id=msg and ticket_id=p_ticket) then return msg; end if;
 if exists(select 1 from public.support_messages where id=msg) then raise exception 'invalid_request'; end if;
 if (select count(*) from public.support_messages where ticket_id=p_ticket and created_at>now()-interval '1 hour')>=60 then raise exception 'rate_limit'; end if;
 next_status := coalesce(p_status,t.status);
 if not p_admin then
   if coalesce((p_message->>'internal')::boolean,false) or p_priority is not null or p_resolution is not null then raise exception 'forbidden'; end if;
   if p_status='closed' and t.status<>'resolved' then raise exception 'confirm_solution_first'; end if;
   if p_status='in_progress' and t.status not in ('resolved','closed') then raise exception 'invalid_transition'; end if;
   if p_status is not null and p_status not in ('closed','in_progress') then raise exception 'forbidden'; end if;
   if p_rating is not null and (t.status<>'resolved' or p_status<>'closed') then raise exception 'forbidden'; end if;
   if p_status is null and t.status='closed' then raise exception 'reopen_first'; end if;
   if p_status is null and t.status='waiting_school' then next_status:='in_progress'; end if;
 end if;
 if next_status in ('resolved','closed') and length(trim(coalesce(p_resolution,t.resolution)))=0 then raise exception 'solution_required'; end if;
 insert into public.support_messages(id,ticket_id,author_role,actor_id,internal,body,attachment_path,attachment_name,attachment_mime,status_change)
 values(msg,p_ticket,case when p_admin then 'admin' else 'school' end,(p_message->>'actor_id')::uuid,
 coalesce((p_message->>'internal')::boolean,false),p_message->>'body',p_message->>'attachment_path',p_message->>'attachment_name',p_message->>'attachment_mime',case when next_status<>t.status then next_status end);
 update public.support_tickets set status=next_status,priority=coalesce(p_priority,priority),resolution=coalesce(p_resolution,resolution),rating=case when next_status='in_progress' and t.status in ('resolved','closed') then null else coalesce(p_rating,rating) end,updated_at=clock_timestamp() where id=p_ticket;
 return msg;
end $$;
revoke all on function public.support_open_ticket(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.support_append_message(uuid,jsonb,boolean,text,text,text,int) from public,anon,authenticated;
grant execute on function public.support_open_ticket(jsonb,jsonb) to service_role;
grant execute on function public.support_append_message(uuid,jsonb,boolean,text,text,text,int) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('support-attachments','support-attachments',false,5242880,array['image/png','image/jpeg','application/pdf'])
on conflict(id) do nothing;
