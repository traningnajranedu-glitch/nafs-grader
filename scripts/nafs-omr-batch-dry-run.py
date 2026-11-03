"""Real PDF smoke test: download and render five unresolved answer-sheet pages.
No grades are calculated or changed. No student images leave the runner.
"""
import io,json,os,pathlib,urllib.parse,urllib.request,subprocess,tempfile
import fitz
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
report={"mode":"real_omr_batch_dry_run","pages_rendered":0,"omr_attempted":0,"omr_readable":0,"errors":0,"grades_written":0,"pages":[]}
path=pathlib.Path("reports/nafs-real-omr-sample.json");path.parent.mkdir(exist_ok=True)
url=os.environ["SUPABASE_URL"].rstrip("/")
key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
creds=Credentials.from_service_account_info(json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]),scopes=["https://www.googleapis.com/auth/drive.readonly"])
drive=build("drive","v3",credentials=creds,cache_discovery=False)
headers={"apikey":key,"Authorization":"Bearer "+key}
folders={"primary3":"1cotd9Fm4nvLR9RBqwHSVou6gqgNNcaiC","middle3":"1vMChKpteUA9injYnPcMifpLtCvpIVtjL","primary6":"1VCyxS4iTC2_sXsCT1AM3zJZtvqZXKkO8"}
report["drive_sources"]={}
for stage,folder in folders.items():
    try:
        response=drive.files().list(q="'"+folder+"' in parents and trashed=false and mimeType='application/pdf'",fields="nextPageToken,files(id)",pageSize=1000).execute()
        report["drive_sources"][stage]={"pdfs_visible_first_page":len(response.get("files",[])),"has_more":bool(response.get("nextPageToken")),"accessible":True}
    except Exception as exc:
        report["drive_sources"][stage]={"accessible":False,"error_type":type(exc).__name__}
selected=[]
run_number=int(os.environ.get("GITHUB_RUN_NUMBER","1"))
rotation=(run_number-1)%6
report["rotation"]=rotation
report["stage_selection"]={}
limit=int(os.environ.get("NAFS_BATCH_LIMIT","100"))
if limit<1 or limit>500:raise ValueError("Batch limit must be 1..500")
stages=("primary3","middle3","primary6")
quotas={stage:limit//len(stages)+(1 if i<limit%len(stages) else 0) for i,stage in enumerate(stages)}
for stage in stages:
    offset=rotation*500
    examined=0
    missing_source=0
    while len([x for x in selected if x[0]==stage])<quotas[stage]:
        params=urllib.parse.urlencode({"select":"id,answers","status":"eq.pending_review","stage":"eq."+stage,"order":"id.asc","limit":"500","offset":str(offset)})
        with urllib.request.urlopen(urllib.request.Request(url+"/rest/v1/nafs_result_import_rows?"+params,headers=headers),timeout=45) as response:rows=json.load(response)
        if not rows:
            if offset>0 and examined==0:
                offset=0
                continue
            break
        for row in rows:
            examined+=1
            answers=row.get("answers") or {}
            if not isinstance(answers,dict):continue
            fid=answers.get("sourcePdfId");page=answers.get("sourcePage")
            if isinstance(fid,str) and fid and type(page)==int and page>0 and not any(x[:3]==(stage,fid,page) for x in selected):
                selected.append((stage,fid,page,row["id"]))
            else:
                missing_source+=1
            if len([x for x in selected if x[0]==stage])>=quotas[stage]:break
        offset+=len(rows)
    report["stage_selection"][stage]={"selected":len([x for x in selected if x[0]==stage]),"rows_examined":examined,"missing_or_duplicate_source":missing_source}
cache={}
for stage,fid,page,row_id in selected:
    try:
        if fid not in cache:
            stream=io.BytesIO()
            downloader=MediaIoBaseDownload(stream,drive.files().get_media(fileId=fid))
            done=False
            while not done:_,done=downloader.next_chunk()
            cache[fid]=stream.getvalue()
        doc=fitz.open(stream=cache[fid],filetype="pdf")
        if page>len(doc):raise ValueError("Invalid page reference")
        pix=doc[page-1].get_pixmap(matrix=fitz.Matrix(1.5,1.5),colorspace=fitz.csGRAY,alpha=False)
        if pix.width<300 or pix.height<300:raise ValueError("Image resolution insufficient")
        report["pages_rendered"]+=1
        report["omr_attempted"]+=1
        with tempfile.NamedTemporaryFile(suffix=".gray",delete=False) as tmp:
            tmp.write(pix.samples);raw_path=tmp.name
        try:
            proc=subprocess.run(["node","scripts/nafs-run-real-omr.cjs",raw_path,str(pix.width),str(pix.height)],capture_output=True,text=True,timeout=60)
            if proc.returncode==0:
                result=json.loads(proc.stdout)
                report["omr_readable"]+=1
                report["pages"].append({"stage":stage,"row_id":row_id,"source_pdf_id":fid,"source_page":page,"rendered":True,"omr":"read","layout":result.get("layout"),"subjects":result["subjects"]})
            else:
                retry=doc[page-1].get_pixmap(matrix=fitz.Matrix(2.0,2.0),colorspace=fitz.csGRAY,alpha=False)
                with tempfile.NamedTemporaryFile(suffix=".gray",delete=False) as tmp2:
                    tmp2.write(retry.samples);retry_path=tmp2.name
                try:
                    second=subprocess.run(["node","scripts/nafs-run-real-omr.cjs",retry_path,str(retry.width),str(retry.height)],capture_output=True,text=True,timeout=60)
                    if second.returncode==0:
                        report["omr_readable"]+=1
                        report["pages"].append({"stage":stage,"row_id":row_id,"source_pdf_id":fid,"source_page":page,"rendered":True,"omr":"read_after_resolution_retry","layout":json.loads(second.stdout).get("layout"),"subjects":json.loads(second.stdout)["subjects"]})
                    else:
                        report["pages"].append({"stage":stage,"row_id":row_id,"source_pdf_id":fid,"source_page":page,"rendered":True,"omr":"requires_review","error_type":"geometry_or_read_failure_after_retry"})
                finally:
                    os.unlink(retry_path)
        finally:
            os.unlink(raw_path)
        doc.close()
    except Exception as exc:
        report["errors"]+=1
        report["pages"].append({"stage":stage,"row_id":row_id,"source_pdf_id":fid,"source_page":page,"rendered":False,"error_type":type(exc).__name__})
path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("Rendered",report["pages_rendered"],"real pages; OMR readable",report["omr_readable"],". No grading or database writes.")
if report["pages_rendered"]==0:raise SystemExit("No real pages rendered")
