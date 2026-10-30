create or replace function public.nafs_verified_analytics(p_stage text default null,p_gender text default null,p_school text default null,p_subject text default null,p_skill text default null)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
with latest as materialized (
 select distinct on (drive_file_id) id,drive_file_id from public.nafs_result_imports
 where stage in ('primary3','primary6','middle3')
 order by drive_file_id,modified_time desc nulls last,imported_at desc,id desc
), base as materialized (
 select r.*,i.drive_file_id,
 case when r.stage='primary3' then 20 else 30 end expected
 from public.nafs_result_import_rows r join latest i on i.id=r.import_id
 where r.stage in ('primary3','primary6','middle3')
), models as (
 select case e.title when 'ثالث ابتدائي' then 'primary3' when 'سادس ابتدائي' then 'primary6' when 'ثالث متوسط' then 'middle3' end stage,
 q.question_number,q.correct_option
 from public.exams e join public.exam_questions q on q.exam_id=e.id
 where e.status='approved' and e.deleted_at is null and e.title in ('ثالث ابتدائي','سادس ابتدائي','ثالث متوسط')
), checked as materialized (
 select b.*,coalesce(v.valid,false) and b.status='verified' and b.total=b.expected
 and b.score is not null and b.score=v.awarded
 and b.gender in ('بنين','بنات') and b.answers->>'sourcePdfId' is not null
 and b.answers->>'sourceSha256' ~ '^[a-f0-9]{64}$'
 and b.answers->>'sourcePage' ~ '^[1-9][0-9]*$' eligible
 from base b left join lateral (
 select count(*)=b.expected and count(distinct (q->>'subject',q->>'number'))=b.expected
 and bool_and(coalesce(
 q->>'subject' in ('arabic','math','science')
 and (b.stage<>'primary3' or q->>'subject'<>'science')
 and q->>'number' ~ '^([1-9]|10)$'
 and q->>'state' in ('clear','multiple','blank','faint')
 and q->>'awarded' in ('0','1')
 and q->>'key'=m.correct_option
 and (q->>'state'<>'clear' or q->>'choice' in ('A','B','C','D'))
 and case when q->>'awarded' in ('0','1') then (q->>'awarded')::numeric end=case when q->>'state'='clear' and q->>'choice'=m.correct_option then 1 else 0 end
 ,false)) valid,sum(case when q->>'awarded' in ('0','1') then (q->>'awarded')::numeric end) awarded
 from jsonb_array_elements(case when jsonb_typeof(b.answers->'questions')='array' then b.answers->'questions' else '[]'::jsonb end) q
 left join models m on m.stage=b.stage and m.question_number=
 case when q->>'number' ~ '^([1-9]|10)$' then (q->>'number')::int + case q->>'subject' when 'arabic' then 0 when 'math' then 20 when 'science' then 40 else -100 end end
 ) v on true
), filtered as materialized (
 select * from checked where (p_stage is null or stage=p_stage)
 and (p_gender is null or gender=p_gender) and (p_school is null or school_name=p_school)
), questions as materialized (
 select f.id,f.stage,f.gender,f.school_name,q->>'subject' subject,(q->>'number')::int number,
 (q->>'awarded')::numeric awarded,s.skill_code,s.skill_name
 from filtered f cross join lateral jsonb_array_elements(f.answers->'questions') q
 left join public.nafs_question_skills s on s.stage=f.stage and s.gender=f.gender
 and s.subject=q->>'subject' and s.question_number=(q->>'number')::int
 and s.correct_answer=q->>'key' and nullif(s.skill_code,'') is not null and nullif(s.skill_name,'') is not null
 where f.eligible and (p_subject is null or q->>'subject'=p_subject)
 and (p_skill is null or s.skill_code=p_skill)
), per_student as (
 select id,stage,gender,school_name,sum(awarded) score,count(*) total from questions group by 1,2,3,4
), school_stats as (
 select f.stage,f.school_name school,count(distinct f.drive_file_id) files,count(*) students,
 count(*) filter(where f.eligible) verified,count(*) filter(where not f.eligible) pending,
 count(*) filter(where f.score is not null) scored,
 count(*) filter(where f.gender='بنين') boys,count(*) filter(where f.gender='بنات') girls,
 (select avg(100.0*p.score/nullif(p.total,0)) from per_student p where p.stage=f.stage and p.school_name=f.school_name) average,
 (select 100.0*count(*) filter(where 1.0*p.score/p.total>=0.8)/nullif(count(*),0) from per_student p where p.stage=f.stage and p.school_name=f.school_name) mastery
 from filtered f group by f.stage,f.school_name
), qstats as (
 select stage,subject,number,count(*) responses,sum(awarded) correct,100.0*avg(awarded) percent,
 case when avg(awarded)>=0.7 then 'سهل' when avg(awarded)>=0.4 then 'متوسط' else 'صعب' end difficulty
 from questions group by 1,2,3
), subjects as (
 select stage,subject,count(*) responses,sum(awarded) correct,100.0*avg(awarded) percent from questions group by 1,2
), skills as (
 select stage,subject,skill_code,skill_name,count(*) responses,100.0*avg(awarded) percent from questions where skill_code is not null group by 1,2,3,4
), genders as (
 select gender,count(*) students,avg(100.0*score/total) percent from per_student group by gender
)
select jsonb_build_object(
 'schools',coalesce((select jsonb_agg(to_jsonb(s) order by s.stage,s.school) from school_stats s),'[]'::jsonb),
 'questions',coalesce((select jsonb_agg(to_jsonb(s) order by stage,subject,number) from qstats s),'[]'::jsonb),
 'subjects',coalesce((select jsonb_agg(to_jsonb(s) order by stage,subject) from subjects s),'[]'::jsonb),
 'skills',coalesce((select jsonb_agg(to_jsonb(s)) from skills s),'[]'::jsonb),
 'genders',coalesce((select jsonb_agg(to_jsonb(s)) from genders s),'[]'::jsonb),
 'options',jsonb_build_object('schools',(select jsonb_agg(school_name order by school_name) from (select distinct school_name from base) s),'skills',(select coalesce(jsonb_agg(distinct jsonb_build_object('code',skill_code,'name',skill_name)),'[]'::jsonb) from public.nafs_question_skills)),
 'summary',jsonb_build_object('students',(select count(*) from filtered),'verified',(select count(*) from filtered where eligible),'excluded',(select count(*) from filtered where not eligible),'missing',(select count(*) from filtered where score is null),'included',(select count(*) from per_student),'percent',(select avg(100.0*score/total) from per_student),'coverage',(select 100.0*count(*) filter(where eligible)/nullif(count(*),0) from filtered),'invalidVerified',(select count(*) from filtered where status='verified' and not eligible),'unmappedQuestions',(select count(*) from questions where skill_code is null)),
 'stages',(select jsonb_agg(s) from (select stage,count(*) students,count(*) filter(where eligible) verified,count(*) filter(where score is null) missing from filtered group by stage) s),
 'checkedAt',now(),'skillMapCount',(select count(*) from public.nafs_question_skills),
 'thresholdNote','نسبة الإتقان هنا نسبة الإجابات الصحيحة. حد 80% وتصنيف الصعوبة حدود تحليلية قابلة للاعتماد، وليست معيارًا رسميًا موثقًا.',
 'source','latest Excel versions / verified source evidence'
);
$$;
revoke all on function public.nafs_verified_analytics(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.nafs_verified_analytics(text,text,text,text,text) to service_role;

