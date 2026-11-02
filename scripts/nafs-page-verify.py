"""Verify actual PDF page bounds for unresolved NAFS references, read-only.

No grades, student identifiers, answer selections, or PDF pages are exported.
"""
import collections,datetime,io,json,os,pathlib,urllib.parse,urllib.request
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from pypdf import PdfReader
FOLDERS={"primary3":"1cotd9Fm4nvLR9RBqwHSVou6gqgNNcaiC","middle3":"1vMChKpteUA9injYnPcMifpLtCvpIVtjL","primary6":"1VCyxS4iTC2_sXsCT1AM3zJZtvqZXKkO8"}
out=pathlib.Path("reports/nafs-page-verify.json");out.parent.mkdir(exist_ok=True)
report={"mode":"read_only","created_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"stages":{},"grades_changed":0,"approved":0,"notes":"A valid page reference does not prove student identity or OMR correctness."}
creds=Credentials.from_service_account_info(json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]),scopes=["https://www.googleapis.com/auth/drive.readonly"])
drive=build("drive","v3",credentials=creds,cache_discovery=False)
url=os.environ["SUPABASE_URL"].rstrip("/");key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
headers={"apikey":key,"Authorization":"Bearer "+key}
for stage,folder in FOLDERS.items():
    ids=set();token=None
    while True:
        kwargs={"q":f"'{folder}' in parents and trashed=false and mimeType='application/pdf'","fields":"nextPageToken,files(id)","pageSize":1000,"supportsAllDrives":True,"includeItemsFromAllDrives":True}
        if token:kwargs["pageToken"]=token
        response=drive.files().list(**kwargs).execute()
        ids.update(f["id"] for f in response.get("files",[]))
        token=response.get("nextPageToken")
        if not token:break
    refs=collections.defaultdict(list)
    stat={"pending":0,"complete_references":0,"missing_reference":0,"not_in_source_folder":0,"valid_page_bounds":0,"page_out_of_range":0,"pdf_read_errors":0,"unique_pdfs_checked":0}
    offset=0
    while True:
        query=urllib.parse.urlencode({"select":"id,answers","stage":"eq."+stage,"status":"eq.pending_review","order":"id.asc","limit":"500","offset":str(offset)})
        with urllib.request.urlopen(urllib.request.Request(url+"/rest/v1/nafs_result_import_rows?"+query,headers=headers),timeout=60) as response:rows=json.load(response)
        for row in rows:
            stat["pending"]+=1
            a=row.get("answers") or {};a=a if isinstance(a,dict) else {}
            fid=a.get("sourcePdfId");page=a.get("sourcePage")
            if not isinstance(fid,str) or not fid or type(page)!=int or page<1:
                stat["missing_reference"]+=1;continue
            stat["complete_references"]+=1
            if fid not in ids:stat["not_in_source_folder"]+=1;continue
            refs[fid].append(page)
        if len(rows)<500:break
        offset+=len(rows)
    for fid,pages in refs.items():
        try:
            buffer=io.BytesIO();downloader=MediaIoBaseDownload(buffer,drive.files().get_media(fileId=fid))
            done=False
            while not done:_,done=downloader.next_chunk()
            count=len(PdfReader(io.BytesIO(buffer.getvalue()),strict=False).pages)
            stat["unique_pdfs_checked"]+=1
            stat["valid_page_bounds"]+=sum(1<=p<=count for p in pages)
            stat["page_out_of_range"]+=sum(p>count for p in pages)
        except Exception:
            stat["pdf_read_errors"]+=len(pages)
    report["stages"][stage]=stat
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("Pending PDF page bounds checked. No scores or approvals changed.")
