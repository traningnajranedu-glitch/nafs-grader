-- Run with execute_sql; all synthetic records roll back.
begin;
set local role service_role;
do $test$
declare v_school uuid; v_student uuid; v_exam uuid; v jsonb; v_token uuid;
begin
 insert into public.schools(name,gender,stage) values('اختبار تقني مؤقت','بنين','متوسط') returning id into v_school;
 insert into public.students(school_id,student_code,full_name,grade) values(v_school,'1000000099','طالب تقني مؤقت','3') returning id into v_student;
 insert into public.exams(title,subject,grade,online_enabled) values('اختبار تقني مؤقت','جميع المواد','3',true) returning id into v_exam;
 insert into public.exam_questions(exam_id,question_number,correct_option,points) values(v_exam,1,'A',1),(v_exam,21,'B',1),(v_exam,41,'C',1);
 update public.exams set status='approved' where id=v_exam;
 v:=public.student_exam_gateway('login','1000000099',null,null,null,'integration-test');
 v_token:=(v->>'token')::uuid;
 if v_token is null then raise exception 'Login failed: %',v; end if;
 v:=public.student_exam_gateway('open',null,v_token,v_exam);
 if v->'questions'<>'[1,21,41]'::jsonb or v ? 'correct_option' or v ? 'score' then raise exception 'Incorrect public exam payload'; end if;
 begin
  perform public.student_exam_gateway('submit',null,v_token,v_exam,'[{"number":1,"option":"Z"}]');
  raise exception 'Invalid answers accepted';
 exception when others then if sqlerrm='Invalid answers accepted' then raise; end if; end;
 v:=public.student_exam_gateway('submit',null,v_token,v_exam,'[{"number":1,"option":"A"},{"number":21,"option":"B"},{"number":41,"option":""}]');
 if v->>'submitted'<>'true' or v ? 'score' then raise exception 'Save failed'; end if;
 if (select score from public.submissions where exam_id=v_exam and student_id=v_student)<>2 then raise exception 'Grade incorrect'; end if;
 perform public.student_exam_gateway('submit',null,v_token,v_exam,'[]');
 if (select count(*) from public.submissions where exam_id=v_exam)<>1 then raise exception 'Duplicate save'; end if;
 update public.exams set online_enabled=false where id=v_exam;
 v:=public.student_exam_gateway('open',null,v_token,v_exam);
 if not(v ? 'error') then raise exception 'Closed exam accessible'; end if;
 update student_private.sessions set expires_at=now()-interval '1 second' where token=v_token;
 v:=public.student_exam_gateway('open',null,v_token,v_exam);
 if not(v ? 'error') then raise exception 'Expired token accessible'; end if;
 if has_function_privilege('anon','public.student_exam_gateway(text,text,uuid,uuid,jsonb,text)','execute') or has_function_privilege('authenticated','public.student_exam_gateway(text,text,uuid,uuid,jsonb,text)','execute') then raise exception 'Gateway exposed'; end if;
end $test$;
rollback;
select 'PASS: service-role login, sparse exam, grading, invalid input, duplicate save, closed exam, expired token and permission isolation; fixtures rolled back' as checks;
