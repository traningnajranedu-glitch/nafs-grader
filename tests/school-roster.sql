begin;
set local role service_role;
do $test$
declare sc uuid; other_sc uuid; result jsonb; token jsonb;
begin
 insert into public.schools(name,gender,stage) values('مدرسة اختبار الاستيراد المؤقت','بنين','متوسط') returning id into sc;
 insert into public.schools(name,gender,stage) values('مدرسة اختبار ثانية مؤقتة','بنين','متوسط') returning id into other_sc;
 result:=public.register_school_roster(sc,'[{"student_code":"1000000088","full_name":"طالب تجربة مؤقت"}]','3','roster-test');
 if result->>'registered'<>'1' then raise exception 'Registration failed'; end if;
 perform public.register_school_roster(sc,'[{"student_code":"1000000088","full_name":"طالب تجربة مؤقت"}]','4','roster-test');
 if (select count(*) from public.students where school_id=sc)<>1 or (select grade from public.students where school_id=sc)<>'3' then raise exception 'Retry overwrote or duplicated student'; end if;
 result:=public.register_school_roster(sc,'[{"student_code":"1000000089","full_name":"طالب جديد مؤقت"},{"student_code":"1000000088","full_name":"اسم مختلف"}]','3','roster-test');
 if not(result ? 'error') or exists(select 1 from public.students where student_code='1000000089') then raise exception 'Conflict was not atomic'; end if;
 result:=public.register_school_roster(other_sc,'[{"student_code":"1000000088","full_name":"طالب تجربة مؤقت"}]','3','roster-test');
 if not(result ? 'error') then raise exception 'School transfer accepted'; end if;
 result:=public.register_school_roster(sc,'[{"student_code":"123","full_name":"طالب مؤقت"}]','3','roster-test');
 if not(result ? 'error') then raise exception 'Invalid ID accepted'; end if;
 token:=public.student_exam_gateway('login','1000000088',null,null,null,'roster-test');
 if not(token ? 'token') then raise exception 'Student login after school import failed'; end if;
 if has_function_privilege('anon','public.register_school_roster(uuid,jsonb,text,text)','execute') then raise exception 'Direct public RPC exposed'; end if;
end $test$;
rollback;
select 'PASS: registration, student login, idempotent import, preservation of existing data, atomic conflict rejection, no school transfer, civil-ID validation, role isolation; fixtures rolled back' as checks;
