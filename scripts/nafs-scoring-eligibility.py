#!/usr/bin/env python3
"""Evaluate OMR evidence using the stage-specific NAFS answer-key scope.
No grades are written. Uncertain marks and unverified layouts remain blocked.
"""
import json, pathlib
audit=json.loads(pathlib.Path("reports/nafs-real-omr-sample.json").read_text(encoding="utf-8"))
keys=json.loads(pathlib.Path("data/nafs-answer-keys-2026.json").read_text(encoding="utf-8"))
EXPECTED={
    "primary3": ["لغتي","رياضيات"],  # science is excluded by the approved primary-3 specification
    "middle3": ["لغتي","رياضيات","علوم"],
}
out={"source_pages":len(audit.get("pages",[])),"readable":0,"complete_candidates":0,
     "needs_review":0,"reference_only":keys.get("approval_policy"),
     "grades_written":0,"scope":EXPECTED,"candidates":[]}
for p in audit.get("pages",[]):
    if not str(p.get("omr","")).startswith("read"): continue
    stage=p.get("stage")
    if stage not in EXPECTED: continue
    out["readable"]+=1
    reasons=[]
    if not p.get("row_id") or not p.get("source_pdf_id") or not p.get("source_page"):
        reasons.append("missing_provenance")
    subs=p.get("subjects",[])
    if len(subs)!=3: reasons.append("subject_count_mismatch")
    stage_keys=keys.get("stages",{}).get(stage,{}).get("subjects",{})
    for i,name in enumerate(EXPECTED[stage]):
        if i>=len(subs):
            reasons.append(name+":missing_omr_subject")
            continue
        answers=subs[i].get("answers",[])
        key=stage_keys.get(name,[])
        if len(answers)!=20: reasons.append(name+":unexpected_grid_size")
        if len(key)!=10 or any(x not in ("أ","ب","ج","د") for x in key):
            reasons.append(name+":unverified_or_missing_key")
        if any(a.get("state")!="blank" for a in answers[10:]):
            reasons.append(name+":nonblank_unused_positions")
        if any(a.get("state")=="uncertain" for a in answers[:10]):
            reasons.append(name+":uncertain_mark")
    if stage=="primary3":
        if keys.get("stages",{}).get("primary3",{}).get("sha256")!="20f85ec29ad5197d15489faa30639ac3a7a42d89d34b436e8591f1fd2ff5d066":
            reasons.append("primary3_original_key_hash_mismatch")
    if stage=="middle3":
        if keys.get("stages",{}).get("middle3",{}).get("sha256")!="5a95121e36ee54d6c6f1fcf8089eb3c91417983e077870ea615144776ec219ee":
            reasons.append("middle3_original_key_hash_mismatch")
        reasons.append("subject_column_mapping_requires_original_sheet_validation")
    if keys.get("approval_policy")!="approved_for_auto_scoring":
        reasons.append("reference_keys_not_authorized")
    ready=not reasons
    if ready: out["complete_candidates"]+=1
    else: out["needs_review"]+=1
    out["candidates"].append({"row_id":p.get("row_id"),"stage":stage,
        "source_pdf_id":p.get("source_pdf_id"),"source_page":p.get("source_page"),
        "approval_ready":ready,"reasons":reasons})
dest=pathlib.Path("reports/nafs-scoring-eligibility.json")
dest.parent.mkdir(exist_ok=True)
dest.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print("Read",out["readable"],"pages; stage-scoped candidates",out["complete_candidates"],"; no grades written.")
