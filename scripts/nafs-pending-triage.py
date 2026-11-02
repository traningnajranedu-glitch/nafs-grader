"""Read-only triage of pending NAFS imports; no student data in reports."""
import collections,datetime,json,os,pathlib,urllib.parse,urllib.request
out=pathlib.Path("reports/nafs-pending-triage.json");out.parent.mkdir(exist_ok=True)
url=os.environ["SUPABASE_URL"].rstrip("/");key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
assert url.startswith("https://")
report={"mode":"read_only","at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"total":0,"stages":{},"writes":0,"approvals":0,"notes":["Source metadata does not establish a verified PDF-page match.","Answer keys must be manually validated before grading."]}
headers={"apikey":key,"Authorization":"Bearer "+key,"Accept":"application/json"}
offset=0
while True:
    qs=urllib.parse.urlencode({"select":"id,stage,score,answers","status":"eq.pending_review","order":"id.asc","limit":"500","offset":str(offset)})
    req=urllib.request.Request(url+"/rest/v1/nafs_result_import_rows?"+qs,headers=headers)
    with urllib.request.urlopen(req,timeout=60) as resp: rows=json.load(resp)
    for row in rows:
        stage=row.get("stage") or "unknown"
        s=report["stages"].setdefault(stage,{"pending":0,"no_score":0,"has_score":0,"pdf_id_present":0,"pdf_page_present":0,"both_pdf_id_and_page":0,"questions_present":0,"subjects_present":0,"needs_source_matching":0})
        a=row.get("answers") or {}
        if not isinstance(a,dict): a={}
        s["pending"]+=1;report["total"]+=1
        s["has_score" if row.get("score") is not None else "no_score"]+=1
        pid=bool(a.get("sourcePdfId"));page=a.get("sourcePage") is not None
        s["pdf_id_present"]+=int(pid);s["pdf_page_present"]+=int(page)
        s["both_pdf_id_and_page"]+=int(pid and page)
        s["needs_source_matching"]+=int(not(pid and page))
        s["questions_present"]+=int(bool(a.get("questions")))
        s["subjects_present"]+=int(bool(a.get("subjects")))
    if len(rows)<500:break
    offset+=len(rows)
out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("Pending triage complete:",report["total"],"rows; no changes or approvals.")
