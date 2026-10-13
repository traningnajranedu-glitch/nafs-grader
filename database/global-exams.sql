-- A single answer key is shared by all schools; student identity determines the school.
update public.exams set school_id=null where deleted_at is null;
do $$
declare v text;
begin
 select pg_get_functiondef('public.save_omr_submission(uuid,uuid,jsonb,jsonb)'::regprocedure) into v;
 v:=replace(v,'select school_id into v_school from public.exams where id=p_exam and deleted_at is null and status=''approved'' for share;',
 'perform 1 from public.exams where id=p_exam and deleted_at is null and status=''approved'' for share;
 if not found then raise exception ''اعتمد مفتاح الإجابة أولًا''; end if;
 select school_id into v_school from public.students where id=p_student;');
 execute v;
end $$;
