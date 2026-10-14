-- Run with a database owner. All fixtures are rolled back.
begin;
do $$
declare s uuid; t uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); n int;
begin
 select id into s from public.schools limit 1;
 perform public.support_open_ticket(jsonb_build_object('id',t,'access_hash',repeat('a',64),'school_id',s,'reporter_name','تحقق آلي','phone','966500000000','service','طباعة النماذج','kind','مشكلة تقنية','title','اختبار مسار البلاغات','client_hash','transaction-test'),jsonb_build_object('id',m,'body','اختبار حفظ البلاغ الأول'));
 perform public.support_open_ticket(jsonb_build_object('id',t,'access_hash',repeat('a',64)),jsonb_build_object('id',m));
 select count(*) into n from public.support_messages where ticket_id=t;
 if n<>1 then raise exception 'duplicate create not idempotent'; end if;
 begin
  perform public.support_append_message(t,jsonb_build_object('id',gen_random_uuid(),'body','تغيير غير مسموح'),false,'resolved');
  raise exception 'school changed status illegally';
 exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if;end;
 begin
  perform public.support_append_message(t,jsonb_build_object('id',gen_random_uuid(),'body','حل دون تفاصيل'),true,'resolved');
  raise exception 'resolution not required';
 exception when raise_exception then if sqlerrm<>'solution_required' then raise; end if;end;
 perform public.support_append_message(t,jsonb_build_object('id',gen_random_uuid(),'body','يرجى إضافة تفاصيل'),true,'waiting_school','high');
 perform public.support_append_message(t,jsonb_build_object('id',gen_random_uuid(),'body','أضافت المدرسة التفاصيل المطلوبة'),false);
 if (select status from public.support_tickets where id=t)<>'in_progress' then raise exception 'reply did not resume work'; end if;
 m:=gen_random_uuid();
 perform public.support_append_message(t,jsonb_build_object('id',m,'body','تمت المعالجة'),true,'resolved',null,'حل تجريبي موثق');
 perform public.support_append_message(t,jsonb_build_object('id',m,'body','تمت المعالجة'),true,'resolved',null,'حل تجريبي موثق');
 select count(*) into n from public.support_messages where id=m;
 if n<>1 then raise exception 'duplicate reply not idempotent'; end if;
 perform public.support_append_message(t,jsonb_build_object('id',gen_random_uuid(),'body','تأكيد الحل'),false,'closed',null,null,5);
 if (select rating from public.support_tickets where id=t)<>5 then raise exception 'rating not saved'; end if;
 perform public.support_append_message(t,jsonb_build_object('id',gen_random_uuid(),'body','المشكلة مستمرة'),false,'in_progress');
 if (select rating from public.support_tickets where id=t) is not null then raise exception 'reopen kept stale rating'; end if;
 if has_table_privilege('anon','public.support_tickets','select') or has_table_privilege('authenticated','public.support_messages','select') then raise exception 'public direct access granted'; end if;
 if has_function_privilege('anon','public.support_open_ticket(jsonb,jsonb)','execute') or has_function_privilege('authenticated','public.support_append_message(uuid,jsonb,boolean,text,text,text,integer)','execute') then raise exception 'privileged RPC exposed'; end if;
 raise notice 'PASS: ticket lifecycle, ownership boundary, required solution, duplicate prevention, rating and reopen';
end $$;
rollback;
