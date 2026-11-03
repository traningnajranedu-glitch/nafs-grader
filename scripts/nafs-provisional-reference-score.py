#!/usr/bin/env python3
"""Provisional answer-level scoring for middle3 only. NEVER writes grades or approves students."""
import json,pathlib
audit=json.loads(pathlib.Path("reports/nafs-real-omr-sample.json").read_text())
keyfile=json.loads(pathlib.Path("data/nafs-answer-keys-2026.json").read_text())
assert keyfile["approval_policy"]=="reference_only_no_auto_approval"
keys=keyfile["stages"]["middle3"]["subjects"]
subjects=("لغتي","رياضيات","علوم")
choices={"أ":"A","ب":"B","ج":"C","د":"D"}
out={"mode":"provisional_reference_only","approved":0,"grades_written":0,"records":[]}
for p in audit["pages"]:
 if p.get("stage")!="middle3" or not str(p.get("omr","")).startswith("read"):continue
 rec={"row_id":p.get("row_id"),"source_pdf_id":p.get("source_pdf_id"),"source_page":p.get("source_page"),"status":"requires_key_and_layout_validation","subjects":{}}
 for i,name in enumerate(subjects):
  answers=p["subjects"][i]["answers"]
  reference=keys[name]
  scored=0;uncertain=0;correct=0
  for reading,key in zip(answers[:10],reference):
   state=reading.get("state")
   if state=="clear" and reading.get("choice") in ("A","B","C","D"):
    correct+=int(reading["choice"]==choices[key]);scored+=1
   elif state in ("blank","multiple"):scored+=1
   else:uncertain+=1
  rec["subjects"][name]={"reference_correct_on_scored_positions":correct,"scored_positions":scored,"uncertain_positions":uncertain,"total_positions":10}
 out["records"].append(rec)
pathlib.Path("reports/nafs-provisional-reference-scores.json").write_text(json.dumps(out,ensure_ascii=False,indent=2))
print("Provisional reference-only comparisons:",len(out["records"]),"; approvals: 0; writes: 0")
