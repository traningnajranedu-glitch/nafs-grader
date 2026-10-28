import io,json,os,sys,hashlib,datetime
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from pypdf import PdfReader
from pathlib import Path

FOLDERS={"primary3":"1cotd9Fm4nvLR9RBqwHSVou6gqgNNcaiC","middle3":"1vMChKpteUA9injYnPcMifpLtCvpIVtjL","primary6":"1VCyxS4iTC2_sXsCT1AM3zJZtvqZXKkO8"}
REPORT=Path("reports/nafs-preflight.json")
REPORT.parent.mkdir(exist_ok=True)
report={"status":"in_progress","started_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"mode":"read_only","stages":{},"errors":[],"approval_changes":0,"excel_changes":0}
def save(): REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
save()
raw=os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
if not raw:
 report["status"]="blocked";report["errors"].append("Missing service account secret");save();sys.exit(1)
try:
 creds=Credentials.from_service_account_info(json.loads(raw),scopes=["https://www.googleapis.com/auth/drive.readonly"])
 drive=build("drive","v3",credentials=creds,cache_discovery=False)
 for stage,folder in FOLDERS.items():
  stat={"files":0,"pages":0,"verified_pdfs":0,"errors":0,"sources":[]}
  report["stages"][stage]=stat
  token=None
  while True:
   page=drive.files().list(q=f"'{folder}' in parents and trashed=false and mimeType='application/pdf'",fields="nextPageToken,files(id,name,size,md5Checksum)",pageSize=1000,pageToken=token,supportsAllDrives=True,includeItemsFromAllDrives=True).execute()
   for item in page.get("files",[]):
    stat["files"]+=1
    try:
     stream=io.BytesIO();downloader=MediaIoBaseDownload(stream,drive.files().get_media(fileId=item["id"]))
     done=False
     while not done: _,done=downloader.next_chunk()
     payload=stream.getvalue();pages=len(PdfReader(io.BytesIO(payload),strict=False).pages)
     stat["pages"]+=pages;stat["verified_pdfs"]+=1
     stat["sources"].append({"file_id":item["id"],"name":item["name"],"pages":pages,"sha256":hashlib.sha256(payload).hexdigest()})
    except Exception as exc:
     stat["errors"]+=1;report["errors"].append({"stage":stage,"file_id":item["id"],"error":str(exc)[:180]})
    save()
   token=page.get("nextPageToken")
   if not token: break
 report["status"]="source_inventory_complete" if not report["errors"] else "partial_source_inventory"
except Exception as exc:
 report["status"]="blocked";report["errors"].append(str(exc)[:300])
report["finished_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
save()
if report["status"]!="source_inventory_complete":sys.exit(1)
print("Source inventory complete. No grading or approvals performed.")
