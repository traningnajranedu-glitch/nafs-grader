alter table public.exams add column if not exists deleted_at timestamptz;
alter table public.exams add column if not exists deleted_by uuid;
create or replace function public.delete_exam(p_exam uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_title text;
begin
 if auth.uid() is null or not exists(select 1 from public.system_admins where user_id=auth.uid()) then raise exception 'الحذف متاح لمدير النظام فقط'; end if;
 select title into v_title from public.exams where id=p_exam and deleted_at is null for update;
 if not found then raise exception 'الاختبار غير موجود أو محذوف مسبقًا'; end if;
 update public.exams set deleted_at=now(),deleted_by=auth.uid() where id=p_exam;
 return jsonb_build_object('id',p_exam,'title',v_title,'deleted',true);
end $$;
revoke all on function public.delete_exam(uuid) from public,anon;
grant execute on function public.delete_exam(uuid) to authenticated;
-- Exclude removed exams from approval and grading entry points.
do $$
declare v text; replacement text; item record;
begin
 for item in select * from (values
  ('public.approve_selected_answer_key(uuid,jsonb)','where id=p_exam for update','where id=p_exam and deleted_at is null for update'),
  ('public.save_omr_submission(uuid,uuid,jsonb,jsonb)','where id=p_exam and status=''approved'' for share','where id=p_exam and deleted_at is null and status=''approved'' for share'),
  ('public.grade_submission(uuid)','where id=v_exam and status in (''approved'',''closed'')','where id=v_exam and deleted_at is null and status in (''approved'',''closed'')')
 ) as items(signature,old_text,new_text)
 loop
  select pg_get_functiondef(item.signature::regprocedure) into v;
  replacement:=replace(v,item.old_text,item.new_text);
  if replacement=v and position(item.new_text in v)=0 then raise exception 'Unexpected function definition: %',item.signature; end if;
  if replacement<>v then execute replacement; end if;
 end loop;
end $$;
