create or replace function public.approve_selected_answer_key(p_exam uuid,p_options jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_status text; v_subject text; v_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.system_admins where user_id=auth.uid()) then raise exception 'صلاحية مدير النظام مطلوبة'; end if;
 select status,subject into v_status,v_subject from public.exams where id=p_exam for update;
 if v_status is distinct from 'draft' then raise exception 'يجب أن يكون الاختبار مسودة؛ المفتاح المعتمد لا يقبل التعديل'; end if;
 v_count:=case when v_subject='جميع المواد' then 60 else 20 end;
 if jsonb_typeof(p_options) is distinct from 'array' then raise exception 'الإجابات غير صالحة'; end if;
 if jsonb_array_length(p_options)<>v_count or exists(select 1 from jsonb_array_elements(p_options) a where jsonb_typeof(a)<>'string' or a#>>'{}' not in ('A','B','C','D')) then raise exception 'اختر إجابة صحيحة واحدة لكل سؤال؛ العدد المطلوب: %',v_count; end if;
 if exists(select 1 from public.exam_questions where exam_id=p_exam) then raise exception 'يوجد مفتاح محفوظ؛ لا يمكن استبداله بهذه العملية'; end if;
 insert into public.exam_questions(exam_id,question_number,correct_option,points)
 select p_exam,ordinality::integer,value,1 from jsonb_array_elements_text(p_options) with ordinality;
 update public.exams set status='approved' where id=p_exam;
 return jsonb_build_object('exam_id',p_exam,'status','approved','question_count',v_count);
end $$;
revoke all on function public.approve_selected_answer_key(uuid,jsonb) from public,anon;
grant execute on function public.approve_selected_answer_key(uuid,jsonb) to authenticated;

create or replace function public.validate_exam_approval()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.status='approved' and new.status='draft' then raise exception 'Approved exams cannot return to draft'; end if;
 if old.status='closed' and new.status<>'closed' then raise exception 'Closed exams cannot be reopened'; end if;
 if new.status in ('approved','closed') and old.status='draft' then
  if not exists(select 1 from public.exam_questions where exam_id=new.id) then raise exception 'Answer key is empty'; end if;
  if new.subject='جميع المواد' and ((select count(*) from public.exam_questions where exam_id=new.id)<>60 or exists(select 1 from public.exam_questions where exam_id=new.id and question_number not between 1 and 60)) then raise exception 'يجب إكمال إجابات المواد الثلاث: 20 سؤالًا لكل مادة'; end if;
 end if;
 return new;
end $$;
update public.exams set subject='لغتي' where subject='القراءة';
