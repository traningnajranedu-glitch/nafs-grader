-- Run in Supabase SQL Editor to enable assigning schools on approved PDF correction.
-- Assign only when the reviewer has approved a result for a student in that school.
create or replace function public.nafs_record_correction(p_submission uuid,p_action text)
returns void language plpgsql security definer set search_path=public as $$
declare v_school uuid; v_reviewer uuid := auth.uid();
begin
 if p_action not in ('corrected','verified') then raise exception 'Invalid action'; end if;
 if not exists(select 1 from nafs_reviewers where user_id=v_reviewer and active) then raise exception 'Reviewer inactive'; end if;
 select st.school_id into v_school from submissions su join students st on st.id=su.student_id where su.id=p_submission;
 if v_school is null then raise exception 'Submission not found'; end if;
 if p_action='corrected' then
   insert into nafs_reviewer_schools(reviewer_id,school_id) values(v_reviewer,v_school)
   on conflict(reviewer_id,school_id) do nothing;
 elsif not exists(select 1 from nafs_correction_audit where submission_id=p_submission and action='corrected') then
   raise exception 'Correction not recorded';
 end if;
 insert into nafs_correction_audit(submission_id,reviewer_id,school_id,action)
 values(p_submission,v_reviewer,v_school,p_action)
 on conflict(submission_id,action) do nothing;
end $$;
revoke all on function public.nafs_record_correction(uuid,text) from public;
grant execute on function public.nafs_record_correction(uuid,text) to authenticated;
