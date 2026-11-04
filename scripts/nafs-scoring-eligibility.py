#!/usr/bin/env python3
"""Stage-specific eligibility and per-question scoring; no database writes."""
import json,pathlib
audit=json.loads(pathlib.Path("reports/nafs-real-omr-sample.json").read_text(encoding="utf-8"))
keys=json.loads(pathlib.Path("data/nafs-answer-keys-2026.json").read_text(encoding="utf-8"))
EXPECTED={"primary3":["لغتي","رياضيات"],"middle3":["لغتي","رياضيات","علوم"]}
SUBJECT_CODE={"لغتي":"arabic","رياضيات":"math","علوم":"science"}
CHOICE={"أ":"A","ب":"B","ج":"C","د":"D"}
out={"source_pages":len(audit.get("pages",[])),"readable":0,"complete_candidates":0,"needs_review":0,
     "grades_written":0,"approval_policy":keys.get("approval_policy"),"scope":EXPECTED,"by_stage":{},"candidates":[]}
for p in audit.get("pages",[]):
    if not str(p.get("omr","")).startswith("read"):continue
    stage=p.get("stage")
    if stage not in EXPECTED:continue
    out["readable"]+=1;reasons=[];expected_total=20 if stage=="primary3" else 30
    if not p.get("source_pdf_id") or not p.get("source_page") or not p.get("row_id"):reasons.append("missing_source_provenance")
    if p.get("source_hash_matches") is not True:reasons.append("source_pdf_hash_not_verified")
    if p.get("gender_valid") is not True:reasons.append("missing_or_invalid_gender")
    if p.get("student_name_present") is not True:reasons.append("missing_student_name")
    if p.get("total_matches") is not True:reasons.append("source_total_mismatch")
    if p.get("layout",{}).get("verified_against_student_sheet") is not True:reasons.append("student_sheet_layout_not_verified")
    stage_key=keys.get("stages",{}).get(stage,{})
    if stage_key.get("layout_verified") is not True:reasons.append("stage_layout_not_approved")
    stage_keys=stage_key.get("subjects",{})
    if keys.get("approval_policy")!="approved_for_auto_scoring":reasons.append("answer_key_not_approved")
    subjects=p.get("subjects",[])
    if len(subjects)!=3:reasons.append("subject_grid_count_mismatch")
    questions=[]
    for i,name in enumerate(EXPECTED[stage]):
        if i>=len(subjects):reasons.append(name+":missing_subject_grid");continue
        answers=subjects[i].get("answers",[])
        key=stage_keys.get(name,[])
        if len(answers)!=20:reasons.append(name+":unexpected_grid_size")
        if len(key)!=10 or any(x not in CHOICE for x in key):reasons.append(name+":missing_or_invalid_key");continue
        for qnum,(reading,arabic_key) in enumerate(zip(answers[:10],key),start=1):
            state=reading.get("state");choice=reading.get("choice")
            if state=="uncertain":reasons.append(name+":"+str(qnum)+":uncertain_mark");continue
            if state not in ("clear","multiple","blank"):
                reasons.append(name+":"+str(qnum)+":unsupported_mark_state");continue
            if state=="clear" and choice not in ("A","B","C","D"):
                reasons.append(name+":"+str(qnum)+":invalid_clear_choice");continue
            correct=CHOICE[arabic_key]
            awarded=1 if state=="clear" and choice==correct else 0
            questions.append({"subject":SUBJECT_CODE[name],"number":qnum,"state":state,
                              "choice":choice if state=="clear" else None,"key":correct,"awarded":awarded})
    ready=not reasons and len(questions)==expected_total
    score=sum(q["awarded"] for q in questions) if ready else None
    if ready:out["complete_candidates"]+=1
    else:out["needs_review"]+=1
    stage_stats=out["by_stage"].setdefault(stage,{"readable":0,"complete_candidates":0,"needs_review":0})
    stage_stats["readable"]+=1
    stage_stats["complete_candidates"]+=int(ready)
    stage_stats["needs_review"]+=int(not ready)
    out["candidates"].append({"row_id":p.get("row_id"),"stage":stage,"source_pdf_id":p.get("source_pdf_id"),
       "source_page":p.get("source_page"),"import_id":p.get("import_id"),"source_sha256":p.get("actual_source_sha256"),
       "approval_ready":ready,"score":score,"total":expected_total if ready else None,
       "questions":questions if ready else [],"reasons":reasons})
dest=pathlib.Path("reports/nafs-scoring-eligibility.json")
dest.parent.mkdir(exist_ok=True);dest.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print("Read",out["readable"],"pages; eligible candidates",out["complete_candidates"],"; no database writes.")
