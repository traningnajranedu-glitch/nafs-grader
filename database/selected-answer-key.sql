create or replace function public.approve_selected_answer_key(p_exam uuid,p_options jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_status text;
begin
 if auth.uid() is null or not exists(select 1 from public.system_admins where user_id=auth.uid()) then raise exception 'صلاحية مدير النظام مطلوبة'; end if;
 select status into v_status from public.exams where id=p_exam for update;
 if v_status is distinct from 'draft' then raise exception 'يجب أن يكون الاختبار مسودة؛ المفتاح المعتمد لا يقبل التعديل'; end if;
 if jsonb_typeof(p_options) is distinct from 'array' then raise exception 'الإجابات غير صالحة'; end if;
 if jsonb_array_length(p_options)<>20 or exists(select 1 from jsonb_array_elements(p_options) a where jsonb_typeof(a)<>'string' or a#>>'{}' not in ('A','B','C','D')) then raise exception 'اختر إجابة صحيحة واحدة لكل سؤال من الأسئلة العشرين'; end if;
 if exists(select 1 from public.exam_questions where exam_id=p_exam) then raise exception 'يوجد مفتاح محفوظ؛ لا يمكن استبداله بهذه العملية'; end if;
 insert into public.exam_questions(exam_id,question_number,correct_option,points)
 select p_exam,ordinality::integer,value,1 from jsonb_array_elements_text(p_options) with ordinality;
 update public.exams set status='approved' where id=p_exam;
 return jsonb_build_object('exam_id',p_exam,'status','approved','question_count',20);
end $$;
revoke all on function public.approve_selected_answer_key(uuid,jsonb) from public,anon;
grant execute on function public.approve_selected_answer_key(uuid,jsonb) to authenticated;
