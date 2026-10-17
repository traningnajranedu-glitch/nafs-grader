-- Apply in Supabase SQL Editor after 20261017_nafs_reviewers.sql.
-- Student-level audit view, reviewer-level school summaries, and strict audit authorization.
create or replace function public.nafs_record_correction(p_submission uuid,p_action text)
returns void language plpgsql security definer set search_path=public as $$
declare v_school uuid; v_reviewer uuid := auth.uid();
begin
 if p_action not in ('corrected','verified') then raise exception 'Invalid action'; end if;
 if not exists(select 1 from nafs_reviewers where user_id=v_reviewer and active) then raise exception 'Reviewer inactive'; end if;
 select st.school_id into v_school from submissions su join students st on st.id=su.student_id where su.id=p_submission;
 if v_school is null then raise exception 'Submission not found'; end if;
 if not exists(select 1 from nafs_reviewer_schools where reviewer_id=v_reviewer and school_id=v_school) then raise exception 'School not assigned'; end if;
 if p_action='verified' and not exists(select 1 from nafs_correction_audit where submission_id=p_submission and action='corrected') then raise exception 'Correction not recorded'; end if;
 insert into nafs_correction_audit(submission_id,reviewer_id,school_id,action)
 values(p_submission,v_reviewer,v_school,p_action) on conflict(submission_id,action) do nothing;
end $$;
revoke all on function public.nafs_record_correction(uuid,text) from public;
grant execute on function public.nafs_record_correction(uuid,text) to authenticated;

create or replace function public.nafs_reviewer_report()
returns table(reviewer_id uuid,reviewer_name text,school_id uuid,school_name text,student_id uuid,student_name text,student_code text,submission_id uuid,exam_id uuid,exam_title text,action text,action_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 if not exists(select 1 from nafs_reviewers where user_id=auth.uid() and active)
 and not exists(select 1 from system_admins where user_id=auth.uid()) then raise exception 'Access denied'; end if;
 return query select a.reviewer_id,r.full_name,a.school_id,sc.name,st.id,st.full_name,st.student_code,
 a.submission_id,su.exam_id,ex.title,a.action,a.created_at
 from nafs_correction_audit a
 join nafs_reviewers r on r.user_id=a.reviewer_id
 join submissions su on su.id=a.submission_id
 join students st on st.id=su.student_id
 join schools sc on sc.id=a.school_id
 join exams ex on ex.id=su.exam_id
 where a.reviewer_id=auth.uid() or exists(select 1 from system_admins where user_id=auth.uid())
 order by a.created_at desc;
end $$;
revoke all on function public.nafs_reviewer_report() from public;
grant execute on function public.nafs_reviewer_report() to authenticated;
