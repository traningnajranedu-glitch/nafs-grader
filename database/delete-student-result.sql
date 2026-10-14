create policy "admin submissions delete" on public.submissions for delete to authenticated
using (exists(select 1 from public.system_admins where user_id=(select auth.uid())));
grant delete on public.submissions to authenticated;
create or replace function public.delete_student_result(p_submission uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_student uuid; v_deleted uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.system_admins where user_id=auth.uid()) then raise exception 'حذف النتائج متاح لمدير النظام فقط'; end if;
 select student_id into v_student from public.submissions where id=p_submission;
 if not found then raise exception 'النتيجة غير موجودة أو محذوفة مسبقًا'; end if;
 perform 1 from public.students where id=v_student for update;
 -- The existing foreign key cascades to this submission's answers only.
 delete from public.submissions where id=p_submission returning id into v_deleted;
 if v_deleted is null then raise exception 'تعذر حذف النتيجة'; end if;
 return jsonb_build_object('id',v_deleted,'deleted',true);
end $$;
revoke all on function public.delete_student_result(uuid) from public,anon;
grant execute on function public.delete_student_result(uuid) to authenticated;
