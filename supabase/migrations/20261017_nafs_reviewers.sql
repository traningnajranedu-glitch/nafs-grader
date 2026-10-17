-- Reviewer accounts and traceable correction workflow (apply in Supabase SQL Editor)
create table if not exists public.nafs_reviewers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (length(trim(full_name)) between 2 and 150),
 username text not null unique,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.nafs_reviewer_schools (
 reviewer_id uuid not null references public.nafs_reviewers(user_id) on delete cascade,
 school_id uuid not null references public.schools(id) on delete cascade,
 assigned_at timestamptz not null default now(),
 primary key (reviewer_id,school_id)
);
create table if not exists public.nafs_correction_audit (
 id bigint generated always as identity primary key,
 submission_id uuid not null references public.submissions(id) on delete cascade,
 reviewer_id uuid not null references public.nafs_reviewers(user_id),
 school_id uuid not null references public.schools(id),
 action text not null check (action in ('corrected','verified')),
 created_at timestamptz not null default now(),
 unique(submission_id,action)
);
create index if not exists nafs_audit_reviewer_idx on public.nafs_correction_audit(reviewer_id,action);
alter table public.nafs_reviewers enable row level security;
alter table public.nafs_reviewer_schools enable row level security;
alter table public.nafs_correction_audit enable row level security;
create policy "reviewers self read" on public.nafs_reviewers for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.system_admins where user_id=auth.uid()));
create policy "assignments read" on public.nafs_reviewer_schools for select to authenticated using (reviewer_id=auth.uid() or exists(select 1 from public.system_admins where user_id=auth.uid()));
create policy "audit read" on public.nafs_correction_audit for select to authenticated using (reviewer_id=auth.uid() or exists(select 1 from public.system_admins where user_id=auth.uid()));
create or replace function public.nafs_record_correction(p_submission uuid,p_action text)
returns void language plpgsql security definer set search_path=public as $$
declare v_school uuid; v_reviewer uuid := auth.uid();
begin
 if p_action not in ('corrected','verified') then raise exception 'Invalid action'; end if;
 if not exists(select 1 from nafs_reviewers where user_id=v_reviewer and active) then raise exception 'Reviewer inactive'; end if;
 select st.school_id into v_school from submissions su join students st on st.id=su.student_id where su.id=p_submission and su.status='graded';
 if v_school is null then raise exception 'Approved submission not found'; end if;
 if not exists(select 1 from nafs_reviewer_schools where reviewer_id=v_reviewer and school_id=v_school) then raise exception 'School not assigned'; end if;
 if p_action='verified' and not exists(select 1 from nafs_correction_audit where submission_id=p_submission and action='corrected') then raise exception 'Correction not yet recorded'; end if;
 insert into nafs_correction_audit(submission_id,reviewer_id,school_id,action) values(p_submission,v_reviewer,v_school,p_action)
 on conflict (submission_id,action) do nothing;
end $$;
revoke all on function public.nafs_record_correction(uuid,text) from public;
grant execute on function public.nafs_record_correction(uuid,text) to authenticated;
