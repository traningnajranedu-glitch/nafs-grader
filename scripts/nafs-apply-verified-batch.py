#!/usr/bin/env python3
"""Apply only fully verified OMR candidates to existing pending rows."""
import json,os,pathlib,urllib.parse,urllib.request,datetime,re,collections,sys
BASE=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEAD={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"}
WRITE=os.environ.get("NAFS_WRITE_APPROVED","").lower()=="true"
ROOT=pathlib.Path("reports")
elig=json.loads((ROOT/"nafs-scoring-eligibility.json").read_text(encoding="utf-8"))
keys=json.loads(pathlib.Path("data/nafs-answer-keys-2026.json").read_text(encoding="utf-8"))
report={"mode":"conditional_verified_write","write_enabled":WRITE,"candidates":0,"updated":0,
        "verified_after_write":0,"skipped":0,"by_stage":{},"skip_reasons":{}}
if keys.get("approval_policy")!="approved_for_auto_scoring":
    raise SystemExit("Approved answer-key policy is missing.")
def api(path,method="GET",payload=None,prefer=None):
    headers=dict(HEAD)
    if prefer:headers["Prefer"]=prefer
    data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode("utf-8")
    req=urllib.request.Request(BASE+path,data=data,headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=60) as response:
        raw=response.read()
        return json.loads(raw.decode("utf-8")) if raw else []
def get_rows(row_id):
    q=urllib.parse.urlencode({"id":"eq."+row_id,"select":"id,import_id,stage,status,student_name,school_name,gender,total,answers","limit":"1"})
    return api("/rest/v1/nafs_result_import_rows?"+q)
def check_latest(import_id):
    q=urllib.parse.urlencode({"id":"eq."+str(import_id),"select":"id,drive_file_id","limit":"1"})
    imports=api("/rest/v1/nafs_result_imports?"+q)
    if len(imports)!=1 or not imports[0].get("drive_file_id"):return False
    drive_id=imports[0]["drive_file_id"]
    params=[("drive_file_id","eq."+str(drive_id)),("select","id,modified_time,imported_at"),
            ("order","modified_time.desc.nullslast,imported_at.desc,id.desc"),("limit","1")]
    latest=api("/rest/v1/nafs_result_imports?"+urllib.parse.urlencode(params))
    return bool(latest and latest[0].get("id")==import_id)
def get_exam_model(stage):
    title="ثالث ابتدائي" if stage=="primary3" else "ثالث متوسط"
    params={"title":"eq."+title,"status":"eq.approved","deleted_at":"is.null","select":"id","limit":"2"}
    exams=api("/rest/v1/exams?"+urllib.parse.urlencode(params))
    if len(exams)!=1:raise ValueError("approved_exam_model_not_unique")
    qs=api("/rest/v1/exam_questions?"+urllib.parse.urlencode({"exam_id":"eq."+exams[0]["id"],"select":"question_number,correct_option","limit":"100"}))
    return {int(x["question_number"]):x["correct_option"] for x in qs}
models={stage:get_exam_model(stage) for stage in ("primary3","middle3")}
offset={"arabic":0,"math":20,"science":40}
def skip(reason):
    report["skipped"]+=1;report["skip_reasons"][reason]=report["skip_reasons"].get(reason,0)+1
for candidate in elig.get("candidates",[]):
    if not candidate.get("approval_ready"):continue
    report["candidates"]+=1
    stage=candidate.get("stage")
    if stage not in ("primary3","middle3"):skip("stage_out_of_scope");continue
    expected=20 if stage=="primary3" else 30
    qs=candidate.get("questions") or []
    if candidate.get("total")!=expected or len(qs)!=expected:skip("question_count_mismatch");continue
    score=sum(int(q.get("awarded",-1)) for q in qs)
    if score!=candidate.get("score"):skip("score_sum_mismatch");continue
    valid=True
    for q in qs:
        state=q.get("state");choice=q.get("choice");key=q.get("key");awarded=q.get("awarded")
        if q.get("subject") not in offset or not isinstance(q.get("number"),int) or not 1<=q["number"]<=10:
            valid=False;break
        if state not in ("clear","multiple","blank") or key not in ("A","B","C","D"):
            valid=False;break
        if state=="clear" and choice not in ("A","B","C","D"):
            valid=False;break
        expected_award=1 if state=="clear" and choice==key else 0
        if awarded!=expected_award or models[stage].get(offset[q["subject"]]+q["number"])!=key:
            valid=False;break
    if not valid:skip("question_or_approved_key_validation_failed");continue
    row_id=candidate.get("row_id")
    rows=get_rows(row_id)
    if len(rows)!=1:skip("row_missing_or_not_unique");continue
    row=rows[0];answers=row.get("answers") or {}
    if row.get("stage")!=stage or row.get("status")!="pending_review":skip("row_not_pending_or_stage_mismatch");continue
    if row.get("import_id")!=candidate.get("import_id") or not check_latest(row.get("import_id")):
        skip("not_latest_import");continue
    if row.get("gender") not in ("بنين","بنات") or not (row.get("student_name") or "").strip() or not (row.get("school_name") or "").strip():
        skip("identity_or_school_incomplete");continue
    try:row_total=int(float(row.get("total")))
    except (TypeError,ValueError):row_total=0
    if row_total!=expected:skip("stored_total_mismatch");continue
    if not isinstance(answers,dict):skip("answers_payload_invalid");continue
    if answers.get("sourcePdfId")!=candidate.get("source_pdf_id"):skip("source_pdf_reference_changed");continue
    try:page=int(answers.get("sourcePage"))
    except (TypeError,ValueError):page=0
    if page!=int(candidate.get("source_page") or 0):skip("source_page_reference_changed");continue
    stored_sha=str(answers.get("sourceSha256") or "").lower()
    actual_sha=str(candidate.get("source_sha256") or "").lower()
    if not re.fullmatch(r"[a-f0-9]{64}",actual_sha) or stored_sha!=actual_sha:
        skip("source_pdf_hash_mismatch");continue
    answers["sourceSha256"]=actual_sha
    answers["sourcePdfId"]=candidate["source_pdf_id"]
    answers["sourcePage"]=page
    answers["questions"]=qs
    answers["correction"]={
      "engine":"Hybrid OMR V4",
      "verifiedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),
      "sourcePdfHashVerified":True,
      "studentSheetLayoutVerified":True,
      "answerKeySha256":keys["stages"][stage]["sha256"],
      "questionCount":expected,
      "scoringRule":"clear single mark only; blank and multiple marks score zero; uncertain marks remain pending"
    }
    if not WRITE:
        skip("write_switch_disabled");continue
    filt=urllib.parse.urlencode({"id":"eq."+row_id,"status":"eq.pending_review","stage":"eq."+stage,"import_id":"eq."+str(row["import_id"])})
    updated=api("/rest/v1/nafs_result_import_rows?"+filt,method="PATCH",
                payload={"score":score,"total":expected,"answers":answers,"status":"verified"},
                prefer="return=representation")
    if len(updated)!=1:skip("conditional_update_not_applied");continue
    report["updated"]+=1
    report["by_stage"][stage]=report["by_stage"].get(stage,0)+1
    verify=get_rows(row_id)
    if len(verify)==1 and verify[0].get("status")=="verified" and int(float(verify[0].get("score") or -1))==score and int(float(verify[0].get("total") or 0))==expected and len((verify[0].get("answers") or {}).get("questions",[]))==expected:
        report["verified_after_write"]+=1
    else:
        skip("post_write_verification_failed")
(ROOT/"nafs-write-verification.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("Candidates",report["candidates"],"updated",report["updated"],"verified after write",report["verified_after_write"],"skipped",report["skipped"])
if WRITE and report["updated"]!=report["verified_after_write"]:
    raise SystemExit("Some written records failed post-write verification.")
