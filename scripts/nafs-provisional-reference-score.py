#!/usr/bin/env python3
"""Create a non-writing summary of eligible per-question scores."""
import json,pathlib
elig=json.loads(pathlib.Path("reports/nafs-scoring-eligibility.json").read_text(encoding="utf-8"))
out={"mode":"verified_candidate_preview_only","approved":0,"grades_written":0,
     "candidate_count":elig.get("complete_candidates",0),"needs_review":elig.get("needs_review",0),
     "records":[{"row_id":x.get("row_id"),"stage":x.get("stage"),"score":x.get("score"),
                 "total":x.get("total"),"question_count":len(x.get("questions",[])),
                 "ready_for_conditional_write":x.get("approval_ready",False)} for x in elig.get("candidates",[]) if x.get("approval_ready")]}
pathlib.Path("reports/nafs-provisional-reference-scores.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print("Prepared",len(out["records"]),"verified-score candidates; no database writes.")
