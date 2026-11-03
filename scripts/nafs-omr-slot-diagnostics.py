#!/usr/bin/env python3
"""Analyze question-slot occupancy to diagnose 20-slot OMR vs 10-item keys.
No grades, personal names or student identifiers are written.
"""
import json,pathlib,collections
src=pathlib.Path("reports/nafs-real-omr-sample.json")
audit=json.loads(src.read_text(encoding="utf-8"))
stats={}
for page in audit.get("pages",[]):
    if not str(page.get("omr","")).startswith("read"):continue
    stage=page.get("stage","unknown")
    for idx,subject in enumerate(page.get("subjects",[])):
        group=stats.setdefault(stage,{}).setdefault(str(idx),{"pages":0,"slots":[collections.Counter() for _ in range(20)]})
        group["pages"]+=1
        for j,a in enumerate(subject.get("answers",[])[:20]):
            group["slots"][j][str(a.get("state","unknown"))]+=1
result={"purpose":"diagnostic_only_no_grades","assumption":"20 OMR positions per subject vs 10 keyed questions; position mapping unverified","stages":{}}
for stage,subjects in stats.items():
    result["stages"][stage]={}
    for idx,g in subjects.items():
        result["stages"][stage][idx]={"pages":g["pages"],"positions":[{"position":i+1,"states":dict(c),"nonblank":sum(n for state,n in c.items() if state!="blank")} for i,c in enumerate(g["slots"])]}
out=pathlib.Path("reports/nafs-omr-slot-diagnostics.json")
out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print("Wrote per-stage, per-subject OMR slot diagnostics. No database writes.")
