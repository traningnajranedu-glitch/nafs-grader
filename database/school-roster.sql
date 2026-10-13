-- School imports register students for online answering without changing prior records.
create or replace function public.register_school_roster(p_school uuid,p_students jsonb,p_grade text,p_client text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_count integer; v_attempts integer; v_bucket timestamptz; v jsonb;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Unauthorized'; end if;
 if p_client is null or length(p_client)>100 then raise exception 'Invalid client'; end if;
 v_bucket:=date_trunc('hour',now());
 insert into student_private.attempts values('roster:'||p_client,v_bucket,1) on conflict(client,bucket) do update set attempts=student_private.attempts.attempts+1 returning attempts into v_attempts;
 if v_attempts>60 then return jsonb_build_object('error','طلبات استيراد كثيرة؛ حاول لاحقًا'); end if;
 if jsonb_typeof(p_students) is distinct from 'array' then return jsonb_build_object('error','بيانات الطلاب غير صالحة'); end if;
 v_count:=jsonb_array_length(p_students);
 if v_count<1 or v_count>250 then return jsonb_build_object('error','يجب أن يحتوي الملف على 1 إلى 250 طالبًا'); end if;
 if length(coalesce(p_grade,''))>50 then return jsonb_build_object('error','الصف غير صالح'); end if;
 if (select count(distinct a->>'student_code') from jsonb_array_elements(p_students) a)<>v_count or exists(select 1 from jsonb_array_elements(p_students) a where coalesce(a->>'student_code','') !~ '^[0-9]{10}$' or length(trim(coalesce(a->>'full_name','')))<2 or length(a->>'full_name')>200) then return jsonb_build_object('error','تحقق من أسماء الطلاب والسجلات المدنية المكونة من 10 أرقام ومن عدم تكرارها'); end if;
 perform 1 from public.schools where id=p_school for share;
 if not found then return jsonb_build_object('error','اختر مدرسة مسجلة من القائمة'); end if;
 -- Lock in a stable order, then validate the whole file before inserting any row.
 for v in select value from jsonb_array_elements(p_students) order by value->>'student_code' loop
  perform pg_advisory_xact_lock(hashtextextended('school-roster:'||(v->>'student_code'),0));
  if exists(select 1 from public.students where student_code=v->>'student_code' and (school_id<>p_school or trim(full_name)<>trim(v->>'full_name'))) then return jsonb_build_object('error','يوجد سجل مدني مسجل ببيانات مختلفة؛ راجع مدير النظام. لم يُحفظ أي تغيير من هذا الملف'); end if;
 end loop;
 insert into public.students(school_id,student_code,full_name,grade)
 select p_school,a->>'student_code',trim(a->>'full_name'),nullif(trim(p_grade),'') from jsonb_array_elements(p_students) a
 on conflict(school_id,student_code) do nothing;
 return jsonb_build_object('registered',v_count);
end $$;
revoke all on function public.register_school_roster(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.register_school_roster(uuid,jsonb,text,text) to service_role;

create or replace function public.school_roster_coverage()
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.system_admins where user_id=auth.uid()) then raise exception 'Unauthorized'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'gender',s.gender,'stage',s.stage,'registered',coalesce(st.n,0),'printed',coalesce(pr.n,0)) order by s.name),'[]'::jsonb)
 from public.schools s
 left join (select school_id,count(*) n from public.students group by school_id) st on st.school_id=s.id
 left join (select school_name,gender,stage,sum(student_count) n from public.answer_sheet_prints group by school_name,gender,stage) pr on trim(pr.school_name)=trim(s.name) and pr.gender=s.gender and pr.stage=s.stage
 where coalesce(st.n,0)>0 or coalesce(pr.n,0)>0);
end $$;
revoke all on function public.school_roster_coverage() from public,anon;
grant execute on function public.school_roster_coverage() to authenticated;
