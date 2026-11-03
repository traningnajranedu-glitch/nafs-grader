#!/usr/bin/env python3
"""Evaluate existing OMR audit against explicit key coverage without writing grades.
Never promotes reference-only keys to approved keys.
"""
import json,pathlib,collections
audit=json.loads(pathlib.Path("reports/nafs-real-omr-sample.json").read_text())
keys=json.loads(pathlib.Path("data/nafs-answer-keys-2026.json").read_text())
names=("لغتي","رياضيات","علوم")
out={"source_pages":len(audit["pages"]),"readable":0,"complete_30_question_candidates":0,"needs_review":0,"reference_only":keys.get("approval_policy"),"grades_written":0,"candidates":[]}
for p in audit["pages"]:
 if not p.get("omr","").startswith("read"):continue
 out["readable"]+=1
 reasons=[]
 if not p.get("row_id") or not p.get("source_pdf_id") or not p.get("source_page"):reasons.append("missing_provenance")
 stage_keys=keys.get("stages",{}).get(p["stage"],{}).get("subjects",{})
 subs=p.get("subjects",[])
 if len(subs)!=3:reasons.append("subject_count_mismatch")
 for i,name in enumerate(names):
  if i>=len(subs):continue
  answers=subs[i].get("answers",[])
  key=stage_keys.get(name,[])
  if len(answers)!=20:reasons.append(name+":unexpected_grid_size")
  if len(key)!=10 or any(x not in ("أ","ب","ج","د") for x in key):reasons.append(name+":unverified_or_missing_key")
  if any(a.get("state")!="blank" for a in answers[10:]):reasons.append(name+":nonblank_unused_positions")
  if any(a.get("state")=="uncertain" for a in answers[:10]):reasons.append(name+":uncertain_mark")
 if keys.get("approval_policy")!="approved_for_auto_scoring":reasons.append("reference_keys_not_authorized")
 if not reasons:out["complete_30_question_candidates"]+=1
 else:out["needs_review"]+=1
 out["candidates"].append({"row_id":p.get("row_id"),"stage":p["stage"],"source_pdf_id":p.get("source_pdf_id"),"source_page":p.get("source_page"),"approval_ready":not reasons,"reasons":reasons})
dest=pathlib.Path("reports/nafs-scoring-eligibility.json")
dest.write_text(json.dumps(out,ensure_ascii=False,indent=2))
print("Read",out["readable"],"pages; approval candidates",out["complete_30_question_candidates"],"; no grades written.")
