CREATE OR REPLACE FUNCTION public.nafs_import_school_summary()
 RETURNS TABLE(stage text, school text, files bigint, students bigint, scored bigint, verified bigint, pending bigint, average numeric, mastery numeric, boys bigint, girls bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with latest as (select distinct on(drive_file_id) id,stage,school_name,status from public.nafs_result_imports order by drive_file_id,modified_time desc,imported_at desc),
r as (select i.stage,i.school_name school,i.id import_id,i.status import_status,x.id row_id,x.gender,x.score,x.total,x.status,x.answers,x.student_name,x.civil_id,
count(*) over(partition by i.stage,x.civil_id) as id_occurrences
from latest i left join public.nafs_result_import_rows x on x.import_id=i.id),
classified as (select *, (row_id is not null and status='verified' and student_name is not null and btrim(student_name)<>'' and civil_id ~ '^[0-9]{10}$' and id_occurrences=1 and score is not null and total>0 and score between 0 and total and answers->>'auditStatus' in ('verified','preserved_prior_approval') and answers->>'sourceSha256' ~ '^[a-f0-9]{64}$' and coalesce(answers->>'sourcePdfId','')<>'' and coalesce(answers->>'reviewReason','')='' and jsonb_array_length(case when jsonb_typeof(answers->'questions')='array' then answers->'questions' else '[]'::jsonb end)=case when stage='primary3' then 20 else 30 end) as source_eligible from r)
select stage,school,count(distinct import_id),count(row_id),count(row_id) filter(where score between 0 and total and total>0),
count(row_id) filter(where source_eligible),count(row_id) filter(where not source_eligible),
avg(100*score/nullif(total,0)) filter(where source_eligible),
100*count(row_id) filter(where source_eligible and 100*score/nullif(total,0)>=80)::numeric/nullif(count(row_id) filter(where source_eligible),0),
count(row_id) filter(where gender ~* 'بنين|ذكور|male'),count(row_id) filter(where gender ~* 'بنات|اناث|female')
from classified group by stage,school;
$function$
