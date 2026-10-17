-- Independent OCR-based correction records. No students or schools table lookup.
create table if not exists public.nafs_scanned_corrections(
 id uuid primary key default gen_random_uuid(),
 reviewer_id uuid not null references public.nafs_reviewers(user_id),
 exam_id uuid not null references public.exams(id),
 school_name text not null, student_name text not null, student_code text not null,
 gender text, stage text, grade text, source_page integer not null,
 score numeric not null, total numeric not null, answers jsonb not null,
 corrected_at timestamptz not null default now(),
 verified_by uuid references public.nafs_reviewers(user_id),
 verified_at timestamptz
);
create index if not exists nafs_scanned_reviewer_idx on public.nafs_scanned_corrections(reviewer_id,corrected_at desc);
alter table public.nafs_scanned_corrections enable row level security;
create policy "scanned reviewer read" on public.nafs_scanned_corrections for select to authenticated using(reviewer_id=auth.uid() or exists(select 1 from public.system_admins where user_id=auth.uid()));
create or replace function public.nafs_save_scanned_correction(p_exam uuid,p_school text,p_name text,p_code text,p_gender text,p_stage text,p_grade text,p_page integer,p_answers jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_score numeric:=0;v_total numeric:=0;v_q record;v_answer text;
begin
 if not exists(select 1 from nafs_reviewers where user_id=auth.uid() and active) then raise exception 'Reviewer inactive'; end if;
 if not exists(select 1 from exams where id=p_exam and status='approved' and deleted_at is null) then raise exception 'Approved exam required'; end if;
 if nullif(trim(p_school),'') is null or nullif(trim(p_name),'') is null or nullif(trim(p_code),'') is null then raise exception 'Paper identity incomplete'; end if;
 if jsonb_typeof(p_answers)<>'object' then raise exception 'Invalid answers'; end if;
 for v_q in select id,question_number,correct_option,points from exam_questions where exam_id=p_exam loop
   v_total:=v_total+coalesce(v_q.points,1);
   v_answer:=p_answers->>v_q.question_number::text;
   if v_answer is not null and v_answer=v_q.correct_option then v_score:=v_score+coalesce(v_q.points,1);end if;
 end loop;
 if v_total<=0 then raise exception 'No approved answer key';end if;
 insert into nafs_scanned_corrections(reviewer_id,exam_id,school_name,student_name,student_code,gender,stage,grade,source_page,score,total,answers)
 values(auth.uid(),p_exam,trim(p_school),trim(p_name),trim(p_code),p_gender,p_stage,p_grade,p_page,v_score,v_total,p_answers)
 returning id into v_id;
 return v_id;
end $$;
create or replace function public.nafs_verify_scanned_correction(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from nafs_reviewers where user_id=auth.uid() and active) then raise exception 'Reviewer inactive';end if;
 update nafs_scanned_corrections set verified_by=auth.uid(),verified_at=now()
 where id=p_id and verified_at is null;
 if not found then raise exception 'Paper already verified or missing';end if;
end $$;
revoke all on function public.nafs_save_scanned_correction(uuid,text,text,text,text,text,text,integer,jsonb) from public;
revoke all on function public.nafs_verify_scanned_correction(uuid) from public;
grant execute on function public.nafs_save_scanned_correction(uuid,text,text,text,text,text,text,integer,jsonb) to authenticated;
grant execute on function public.nafs_verify_scanned_correction(uuid) to authenticated;
