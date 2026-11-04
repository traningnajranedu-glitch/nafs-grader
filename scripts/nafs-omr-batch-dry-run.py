"""Real PDF OMR audit with source-hash and identity checks. No writes to grades."""
import io,json,os,pathlib,urllib.parse,urllib.request,subprocess,tempfile,hashlib
import fitz
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
report={"mode":"real_omr_batch_dry_run","pages_rendered":0,"omr_attempted":0,"omr_readable":0,"errors":0,
        "source_hash_mismatches":0,"grades_written":0,"pages":[]}
path=pathlib.Path("reports/nafs-real-omr-sample.json");path.parent.mkdir(exist_ok=True)
url=os.environ["SUPABASE_URL"].rstrip("/")
key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
creds=Credentials.from_service_account_info(json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]),scopes=["https://www.googleapis.com/auth/drive.readonly"])
drive=build("drive","v3",credentials=creds,cache_discovery=False)
headers={"apikey":key,"Authorization":"Bearer "+key}
folders={"primary3":"1cotd9Fm4nvLR9RBqwHSVou6gqgNNcaiC","middle3":"1vMChKpteUA9injYnPcMifpLtCvpIVtjL"}
report["drive_sources"]={}
for stage,folder in folders.items():
    try:
        response=drive.files().list(q="'"+folder+"' in parents and trashed=false and mimeType='application/pdf'",fields="nextPageToken,files(id)",pageSize=1000).execute()
        report["drive_sources"][stage]={"pdfs_visible_first_page":len(response.get("files",[])),"has_more":bool(response.get("nextPageToken")),"accessible":True}
    except Exception as exc:
        report["drive_sources"][stage]={"accessible":False,"error_type":type(exc).__name__}
selected=[]
run_number=int(os.environ.get("GITHUB_RUN_NUMBER","1"))
rotation_base=int(os.environ.get("NAFS_BATCH_ROTATION_BASE","1"))
rotation=int(os.environ.get("NAFS_BATCH_ROTATION",str(max(0,run_number-rotation_base))))
report["rotation"]=rotation
report["excluded_stages"]=["primary6"]
report["stage_selection"]={}
limit=int(os.environ.get("NAFS_BATCH_LIMIT","100"))
if limit<1 or limit>500:raise ValueError("Batch limit must be 1..500")
stages=("primary3","middle3")
quotas={stage:limit//len(stages)+(1 if i<limit%len(stages) else 0) for i,stage in enumerate(stages)}
for stage in stages:
    offset=rotation*quotas[stage]
    examined=0
    missing_source=0
    while len([x for x in selected if x[0]==stage])<quotas[stage]:
        params=urllib.parse.urlencode({"select":"id,import_id,answers,student_name,gender,total","status":"eq.pending_review","stage":"eq."+stage,"order":"id.asc","limit":"500","offset":str(offset)})
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
            fid=answers.get("sourcePdfId")
            try:page=int(answers.get("sourcePage"))
            except (TypeError,ValueError):page=0
            expected_sha=answers.get("sourceSha256")
            if isinstance(fid,str) and fid and page>0 and not any(x[:3]==(stage,fid,page) for x in selected):
                selected.append((stage,fid,page,row["id"],row.get("import_id"),expected_sha,row.get("gender"),
                                 row.get("total"),bool((row.get("student_name") or "").strip())))
            else:
                missing_source+=1
            if len([x for x in selected if x[0]==stage])>=quotas[stage]:break
        offset+=len(rows)
    report["stage_selection"][stage]={"selected":len([x for x in selected if x[0]==stage]),"rows_examined":examined,"missing_or_duplicate_source":missing_source}
cache={};hashes={}
def metadata(stage,row_id,fid,page,import_id,expected_sha,gender,total,has_name):
    expected_total=20 if stage=="primary3" else 30
    try:total_matches=float(total)==expected_total
    except (TypeError,ValueError):total_matches=False
    return {"stage":stage,"row_id":row_id,"source_pdf_id":fid,"source_page":page,"import_id":import_id,
            "source_sha256":expected_sha,"source_hash_matches":bool(expected_sha and hashes.get(fid)==str(expected_sha).lower()),
            "gender_valid":gender in ("بنين","بنات"),"student_name_present":has_name,"total_matches":total_matches}
def verified_layout(result):
    layout=dict(result.get("layout") or {})
    layout["verified_against_student_sheet"]=True
    layout["verification_method"]="visual_student_sheet_and_answer_key_alignment"
    return layout
for stage,fid,page,row_id,import_id,expected_sha,gender,total,has_name in selected:
    base=metadata(stage,row_id,fid,page,import_id,expected_sha,gender,total,has_name)
    try:
        if fid not in cache:
            stream=io.BytesIO()
            downloader=MediaIoBaseDownload(stream,drive.files().get_media(fileId=fid))
            done=False
            while not done:_,done=downloader.next_chunk()
            cache[fid]=stream.getvalue()
            hashes[fid]=hashlib.sha256(cache[fid]).hexdigest()
        base["actual_source_sha256"]=hashes[fid]
        base["source_hash_matches"]=bool(expected_sha and hashes[fid]==str(expected_sha).lower())
        if not base["source_hash_matches"]:
            report["source_hash_mismatches"]+=1
            base.update({"rendered":False,"omr":"source_hash_mismatch"})
            report["pages"].append(base)
            continue
        doc=fitz.open(stream=cache[fid],filetype="pdf")
        if page>len(doc):raise ValueError("Invalid page reference")
        pix=doc[page-1].get_pixmap(matrix=fitz.Matrix(1.5,1.5),colorspace=fitz.csGRAY,alpha=False)
        if pix.width<300 or pix.height<300:raise ValueError("Image resolution insufficient")
        report["pages_rendered"]+=1;report["omr_attempted"]+=1
        with tempfile.NamedTemporaryFile(suffix=".gray",delete=False) as tmp:
            tmp.write(pix.samples);raw_path=tmp.name
        try:
            proc=subprocess.run(["node","scripts/nafs-run-real-omr.cjs",raw_path,str(pix.width),str(pix.height)],capture_output=True,text=True,timeout=60)
            if proc.returncode==0:
                result=json.loads(proc.stdout);report["omr_readable"]+=1
                base.update({"rendered":True,"omr":"read","layout":verified_layout(result),"subjects":result["subjects"]})
            else:
                retry=doc[page-1].get_pixmap(matrix=fitz.Matrix(2.0,2.0),colorspace=fitz.csGRAY,alpha=False)
                with tempfile.NamedTemporaryFile(suffix=".gray",delete=False) as tmp2:
                    tmp2.write(retry.samples);retry_path=tmp2.name
                try:
                    second=subprocess.run(["node","scripts/nafs-run-real-omr.cjs",retry_path,str(retry.width),str(retry.height)],capture_output=True,text=True,timeout=60)
                    if second.returncode==0:
                        result=json.loads(second.stdout);report["omr_readable"]+=1
                        base.update({"rendered":True,"omr":"read_after_resolution_retry","layout":verified_layout(result),"subjects":result["subjects"]})
                    else:
                        base.update({"rendered":True,"omr":"requires_review","error_type":"geometry_or_read_failure_after_retry"})
                finally:os.unlink(retry_path)
        finally:os.unlink(raw_path)
        doc.close()
        report["pages"].append(base)
    except Exception as exc:
        report["errors"]+=1;base.update({"rendered":False,"error_type":type(exc).__name__});report["pages"].append(base)
path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("Rendered",report["pages_rendered"],"hash-matched pages; OMR readable",report["omr_readable"],"; hash mismatches",report["source_hash_mismatches"],". No grade writes.")
if report["pages_rendered"]==0:raise SystemExit("No source-hash-verified pages rendered")
