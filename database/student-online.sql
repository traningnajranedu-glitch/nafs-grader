alter table public.exams add column if not exists online_enabled boolean not null default false;
alter table public.submissions drop constraint submissions_source_check;
alter table public.submissions add constraint submissions_source_check check(source in ('excel','omr','online'));
create schema if not exists student_private;
revoke all on schema student_private from public,anon,authenticated;
grant usage on schema student_private to service_role;
create table student_private.sessions(token uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),expires_at timestamptz not null default now()+interval '6 hours');
create table student_private.attempts(client text not null,bucket timestamptz not null,attempts integer not null,primary key(client,bucket));
alter table student_private.sessions enable row level security;
alter table student_private.attempts enable row level security;
grant all on all tables in schema student_private to service_role;
-- Only the Edge Function may call this gateway. Never returns correct answers or scores.
create or replace function public.student_exam_gateway(p_action text,p_code text default null,p_token uuid default null,p_exam uuid default null,p_answers jsonb default null,p_client text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_student public.students; v_exam public.exams; v_token uuid; v_count integer; v_attempts integer; v_submission uuid; v_exams jsonb; v_questions jsonb; v_bucket timestamptz;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Unauthorized'; end if;
 if p_action='login' then
  if p_client is null or length(p_client)>100 then raise exception 'Invalid request'; end if;
  v_bucket:=date_trunc('hour',now())+floor(extract(minute from now())/15)*interval '15 minutes';
  insert into student_private.attempts values(p_client,v_bucket,1) on conflict(client,bucket) do update set attempts=student_private.attempts.attempts+1 returning attempts into v_attempts;
  if v_attempts>600 then return jsonb_build_object('error','محاولات دخول كثيرة؛ حاول لاحقًا'); end if;
  if p_code is null or p_code !~ '^[0-9]{10}$' then return jsonb_build_object('error','أدخل سجلًا مدنيًا مكونًا من 10 أرقام'); end if;
  insert into student_private.attempts values(p_client||':'||md5(p_code),v_bucket,1) on conflict(client,bucket) do update set attempts=student_private.attempts.attempts+1 returning attempts into v_attempts;
  if v_attempts>10 then return jsonb_build_object('error','محاولات دخول كثيرة لهذا السجل؛ حاول لاحقًا'); end if;
  if (select count(*) from public.students where student_code=p_code)<>1 then return jsonb_build_object('error','تعذر العثور على سجل طالب واحد؛ راجع مسؤول المدرسة لتسجيل بياناتك'); end if;
  select * into v_student from public.students where student_code=p_code;
  insert into student_private.sessions(student_id) values(v_student.id) returning token into v_token;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'subject',e.subject,'submitted',exists(select 1 from public.submissions s where s.student_id=v_student.id and s.exam_id=e.id)) order by e.created_at desc),'[]'::jsonb) into v_exams from public.exams e where e.deleted_at is null and e.status='approved' and e.online_enabled and (nullif(trim(e.grade),'') is null or nullif(trim(v_student.grade),'') is null or trim(e.grade)=trim(v_student.grade)) and exists(select 1 from public.exam_questions q where q.exam_id=e.id);
  delete from student_private.sessions where expires_at<now();
  delete from student_private.attempts where bucket<now()-interval '1 day';
  return jsonb_build_object('token',v_token,'student',jsonb_build_object('name',v_student.full_name,'code',v_student.student_code,'grade',v_student.grade,'school',(select name from public.schools where id=v_student.school_id)),'exams',v_exams);
 end if;
 select s.* into v_student from public.students s join student_private.sessions t on t.student_id=s.id where t.token=p_token and t.expires_at>now();
 if v_student.id is null then return jsonb_build_object('error','انتهت جلسة الدخول؛ أدخل سجلك المدني مرة أخرى'); end if;
 -- Serialize concurrent submissions and lock publication status during save.
 perform 1 from public.students where id=v_student.id for update;
 select * into v_exam from public.exams where id=p_exam and status='approved' and deleted_at is null and online_enabled for share;
 if v_exam.id is null then return jsonb_build_object('error','الاختبار غير متاح حاليًا'); end if;
 if nullif(trim(v_exam.grade),'') is not null and nullif(trim(v_student.grade),'') is not null and trim(v_exam.grade)<>trim(v_student.grade) then return jsonb_build_object('error','الاختبار غير مخصص لصفك'); end if;
 if exists(select 1 from public.submissions where exam_id=p_exam and student_id=v_student.id) then return jsonb_build_object('submitted',true); end if;
 select count(*),jsonb_agg(question_number order by question_number) into v_count,v_questions from public.exam_questions where exam_id=p_exam;
 if v_count=0 then return jsonb_build_object('error','نموذج الإجابة غير جاهز'); end if;
 if p_action='open' then return jsonb_build_object('title',v_exam.title,'subject',v_exam.subject,'questions',v_questions); end if;
 if p_action<>'submit' then raise exception 'Invalid action'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'إجابات غير صالحة'; end if;
 if jsonb_array_length(p_answers)<>v_count or (select count(distinct (a->>'number')::integer) from jsonb_array_elements(p_answers) a)<>v_count or exists(select 1 from jsonb_array_elements(p_answers) a where not exists(select 1 from public.exam_questions q where q.exam_id=p_exam and q.question_number=(a->>'number')::integer) or coalesce(a->>'option','') not in ('','A','B','C','D')) then raise exception 'الإجابات لا تطابق نموذج الاختبار'; end if;
 insert into public.submissions(exam_id,student_id,source,status) values(p_exam,v_student.id,'online','pending') returning id into v_submission;
 insert into public.student_answers(submission_id,question_id,selected_option,is_correct,awarded_points)
 select v_submission,q.id,nullif(a->>'option',''),coalesce(a->>'option'=q.correct_option,false),case when a->>'option'=q.correct_option then q.points else 0 end from jsonb_array_elements(p_answers) a join public.exam_questions q on q.exam_id=p_exam and q.question_number=(a->>'number')::integer;
 update public.submissions set status='graded',score=(select coalesce(sum(awarded_points),0) from public.student_answers where submission_id=v_submission) where id=v_submission;
 return jsonb_build_object('submitted',true);
end $$;
revoke all on function public.student_exam_gateway(text,text,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.student_exam_gateway(text,text,uuid,uuid,jsonb,text) to service_role;
