"""Match pending NAFS source references against Drive metadata; never grade or write results."""
import collections,datetime,json,os,pathlib,urllib.parse,urllib.request
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
FOLDERS={"primary3":"1cotd9Fm4nvLR9RBqwHSVou6gqgNNcaiC","middle3":"1vMChKpteUA9injYnPcMifpLtCvpIVtjL","primary6":"1VCyxS4iTC2_sXsCT1AM3zJZtvqZXKkO8"}
out=pathlib.Path("reports/nafs-source-match.json");out.parent.mkdir(exist_ok=True)
report={"mode":"read_only","created_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"stages":{},"student_data_exported":False,"grades_changed":0,"approvals":0}
raw=os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"];creds=Credentials.from_service_account_info(json.loads(raw),scopes=["https://www.googleapis.com/auth/drive.readonly"])
drive=build("drive","v3",credentials=creds,cache_discovery=False)
url=os.environ["SUPABASE_URL"].rstrip("/");key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
headers={"apikey":key,"Authorization":"Bearer "+key,"Accept":"application/json"}
for stage,folder in FOLDERS.items():
    ids=set();token=None
    while True:
        args={"q":f"'{folder}' in parents and trashed=false and mimeType='application/pdf'","fields":"nextPageToken,files(id)","pageSize":1000,"supportsAllDrives":True,"includeItemsFromAllDrives":True}
        if token:args["pageToken"]=token
        result=drive.files().list(**args).execute()
        ids.update(item["id"] for item in result.get("files",[]))
        token=result.get("nextPageToken")
        if not token:break
    stat={"drive_pdf_files":len(ids),"pending":0,"source_reference_complete":0,"source_file_in_drive":0,"source_file_missing":0,"source_page_positive":0,"needs_manual_matching":0}
    offset=0
    while True:
        qs=urllib.parse.urlencode({"select":"id,answers","stage":"eq."+stage,"status":"eq.pending_review","order":"id.asc","limit":"500","offset":str(offset)})
        with urllib.request.urlopen(urllib.request.Request(url+"/rest/v1/nafs_result_import_rows?"+qs,headers=headers),timeout=60) as resp:rows=json.load(resp)
        for row in rows:
            a=row.get("answers") or {};a=a if isinstance(a,dict) else {}
            fid=a.get("sourcePdfId");page=a.get("sourcePage")
            stat["pending"]+=1
            if fid and isinstance(page,int) and not isinstance(page,bool) and page>=1:
                stat["source_reference_complete"]+=1
                if fid in ids:stat["source_file_in_drive"]+=1;stat["source_page_positive"]+=1
                else:stat["source_file_missing"]+=1
            else:stat["needs_manual_matching"]+=1
        if len(rows)<500:break
        offset+=len(rows)
    report["stages"][stage]=stat
out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("NAFS source-reference comparison complete. No grading or writes.")
