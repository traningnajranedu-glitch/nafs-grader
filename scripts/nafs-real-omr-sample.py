"""Real PDF smoke test: download and render five unresolved answer-sheet pages.
No grades are calculated or changed. No student images leave the runner.
"""
import io,json,os,pathlib,urllib.parse,urllib.request
import fitz
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
report={"mode":"real_pdf_render_only","pages_rendered":0,"errors":0,"grades_written":0,"pages":[]}
path=pathlib.Path("reports/nafs-real-omr-sample.json");path.parent.mkdir(exist_ok=True)
url=os.environ["SUPABASE_URL"].rstrip("/")
key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
creds=Credentials.from_service_account_info(json.loads(os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]),scopes=["https://www.googleapis.com/auth/drive.readonly"])
drive=build("drive","v3",credentials=creds,cache_discovery=False)
headers={"apikey":key,"Authorization":"Bearer "+key}
selected=[]
for stage in ("primary3","middle3"):
    offset=0
    while len([x for x in selected if x[0]==stage]) < (3 if stage=="primary3" else 2):
        params=urllib.parse.urlencode({"select":"answers","status":"eq.pending_review","stage":"eq."+stage,"order":"id.asc","limit":"500","offset":str(offset)})
        with urllib.request.urlopen(urllib.request.Request(url+"/rest/v1/nafs_result_import_rows?"+params,headers=headers),timeout=45) as response:rows=json.load(response)
        if not rows:break
        for row in rows:
            answers=row.get("answers") or {}
            if not isinstance(answers,dict):continue
            fid=answers.get("sourcePdfId");page=answers.get("sourcePage")
            if isinstance(fid,str) and fid and type(page)==int and page>0 and (stage,fid,page) not in selected:
                selected.append((stage,fid,page))
            if len([x for x in selected if x[0]==stage]) >= (3 if stage=="primary3" else 2):break
        offset+=len(rows)
cache={}
for stage,fid,page in selected:
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
        report["pages"].append({"stage":stage,"rendered":True,"width":pix.width,"height":pix.height})
        doc.close()
    except Exception as exc:
        report["errors"]+=1
        report["pages"].append({"stage":stage,"rendered":False,"error_type":type(exc).__name__})
path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print("Rendered",report["pages_rendered"],"real PDF pages. No OMR grading or database changes.")
if report["pages_rendered"]!=5:raise SystemExit("Five-page rendering test incomplete")
