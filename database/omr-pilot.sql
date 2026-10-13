alter table public.submissions add column if not exists omr_review jsonb;
alter table public.student_answers add column if not exists omr_reading jsonb;
create or replace function public.save_omr_submission(p_exam uuid,p_student uuid,p_answers jsonb,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_school uuid; v_count integer; v_score numeric; v_total numeric;
begin
 if auth.uid() is null or not exists(select 1 from public.system_admins where user_id=auth.uid()) then raise exception 'Unauthorized'; end if;
 select school_id into v_school from public.exams where id=p_exam and deleted_at is null and status='approved' for share;
 if v_school is null then raise exception 'اعتمد مفتاح الإجابة أولًا'; end if;
 if not exists(select 1 from public.students where id=p_student and school_id=v_school) then raise exception 'الطالب لا يتبع المدرسة المختارة'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' or coalesce((p_review->>'manual_identity_confirmed')::boolean,false)=false then raise exception 'المراجعة غير مكتملة'; end if;
 select count(*),sum(points) into v_count,v_total from public.exam_questions where exam_id=p_exam;
 if v_count=0 or jsonb_array_length(p_answers)<>v_count then raise exception 'عدد الإجابات لا يطابق المفتاح'; end if;
 if (select count(distinct a->>'question_id') from jsonb_array_elements(p_answers) a)<>v_count or exists(select 1 from jsonb_array_elements(p_answers) a where not exists(select 1 from public.exam_questions q where q.id=(a->>'question_id')::uuid and q.exam_id=p_exam) or (a->>'selected_option' is not null and a->>'selected_option' not in ('A','B','C','D')) or coalesce(a->>'reading_state','') not in ('clear','blank','multiple','uncertain') or (a->>'reading_state'<>'clear' and not coalesce((a->>'reviewed')::boolean,false))) then raise exception 'إجابات غير صالحة أو حالات غير مراجعة'; end if;
 if exists(select 1 from public.submissions where exam_id=p_exam and student_id=p_student) then raise exception 'هذا الطالب مصحح مسبقًا لهذا الاختبار'; end if;
 insert into public.submissions(exam_id,student_id,source,status,omr_review) values(p_exam,p_student,'omr','review',p_review||jsonb_build_object('reviewer_id',auth.uid(),'reviewed_at',now())) returning id into v_id;
 insert into public.student_answers(submission_id,question_id,selected_option,is_correct,awarded_points,omr_reading)
 select v_id,q.id,a->>'selected_option',coalesce(a->>'selected_option'=q.correct_option,false),case when a->>'selected_option'=q.correct_option then q.points else 0 end,a-'question_id'-'selected_option' from jsonb_array_elements(p_answers) a join public.exam_questions q on q.id=(a->>'question_id')::uuid;
 select coalesce(sum(awarded_points),0) into v_score from public.student_answers where submission_id=v_id;
 update public.submissions set status='graded',score=v_score where id=v_id;
 return jsonb_build_object('submission_id',v_id,'score',v_score,'total',v_total);
end $$;
revoke all on function public.save_omr_submission(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_omr_submission(uuid,uuid,jsonb,jsonb) to authenticated;
