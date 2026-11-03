-- NAFS 2026: non-mutating, reproducible verification audit.
-- Run in Supabase SQL editor. Never approve or change student scores based on this report alone.
WITH latest AS (
 SELECT DISTINCT ON (drive_file_id) id
 FROM public.nafs_result_imports
 WHERE stage IN ('primary3','primary6','middle3')
 ORDER BY drive_file_id,modified_time DESC NULLS LAST,imported_at DESC,id DESC
), rows AS (
 SELECT r.*, CASE WHEN r.stage='primary3' THEN 20 ELSE 30 END expected
 FROM public.nafs_result_import_rows r JOIN latest l ON l.id=r.import_id
), checked AS (
 SELECT r.*,
  (r.answers->>'sourcePdfId' IS NOT NULL AND r.answers->>'sourceSha256' ~ '^[a-f0-9]{64}$'
   AND r.answers->>'sourcePage' ~ '^[1-9][0-9]*$') source_ok,
  (jsonb_typeof(r.answers->'questions')='array'
   AND jsonb_array_length(CASE WHEN jsonb_typeof(r.answers->'questions')='array' THEN r.answers->'questions' ELSE '[]'::jsonb END)=r.expected) questions_ok
 FROM rows r
)
SELECT stage, count(*) FILTER (WHERE status='verified') verified_latest,
 count(*) FILTER (WHERE status='pending_review') pending_latest,
 count(*) FILTER (WHERE status='verified' AND NOT source_ok) missing_pdf_provenance,
 count(*) FILTER (WHERE status='verified' AND NOT questions_ok) missing_question_details,
 count(*) FILTER (WHERE status='verified' AND gender NOT IN ('بنين','بنات') OR status='verified' AND gender IS NULL) missing_gender,
 count(*) FILTER (WHERE status='verified' AND source_ok AND questions_ok AND gender IN ('بنين','بنات')) provenance_complete
FROM checked GROUP BY stage ORDER BY stage;

-- Grade integrity: only return anonymized identifiers for review, not automatic correction.
WITH latest AS (
 SELECT DISTINCT ON (drive_file_id) id FROM public.nafs_result_imports
 WHERE stage IN ('primary3','primary6','middle3')
 ORDER BY drive_file_id,modified_time DESC NULLS LAST,imported_at DESC,id DESC
), rows AS (
 SELECT r.id,r.stage,r.score,r.total,r.answers FROM public.nafs_result_import_rows r
 JOIN latest l ON l.id=r.import_id WHERE r.status='verified'
 AND jsonb_typeof(r.answers->'questions')='array'
), sums AS (
 SELECT r.id,r.stage,r.score,r.total,
 (SELECT sum((q->>'awarded')::int) FROM jsonb_array_elements(r.answers->'questions') q
  WHERE q->>'awarded' IN ('0','1')) recomputed_score
 FROM rows r
)
SELECT id,stage,score,total,recomputed_score
FROM sums WHERE score IS DISTINCT FROM recomputed_score ORDER BY stage,id;
