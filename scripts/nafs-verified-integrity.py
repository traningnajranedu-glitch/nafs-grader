#!/usr/bin/env python3
"""Read-only integrity audit of current Supabase import rows.
Outputs aggregate counts only. No student identifiers or score writes.
"""
import os,json,urllib.request,urllib.parse,collections,pathlib
url=os.environ["SUPABASE_URL"].rstrip("/")+"/rest/v1/"
key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
def get(table,params):
 query=urllib.parse.urlencode(params)
 req=urllib.request.Request(url+table+"?"+query,headers={"apikey":key,"Authorization":"Bearer "+key,"Accept":"application/json"})
 with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
imports=[]
for offset in range(0,20000,1000):
 batch=get("nafs_result_imports",{"select":"id,drive_file_id,stage,modified_time,imported_at","limit":1000,"offset":offset,"order":"imported_at.desc"})
 imports+=batch
 if len(batch)<1000:break
latest={}
for item in imports:
 if item["stage"] not in ("primary3","primary6","middle3"):continue
 fid=item["drive_file_id"]
 current=latest.get(fid)
 if not current or (item.get("modified_time") or "",item.get("imported_at") or "",item["id"])>(current.get("modified_time") or "",current.get("imported_at") or "",current["id"]):latest[fid]=item
latest_ids={x["id"] for x in latest.values()}
summary=collections.defaultdict(collections.Counter)
for offset in range(0,100000,1000):
 batch=get("nafs_result_import_rows",{"select":"import_id,stage,status,score,total,gender,answers","limit":1000,"offset":offset,"order":"id.asc"})
 for row in batch:
  if row["import_id"] not in latest_ids:continue
  c=summary[row["stage"]]
  c["latest_total"]+=1
  if row["status"]!="verified":c["not_verified"]+=1;continue
  c["verified"]+=1
  a=row.get("answers") or {}
  questions=a.get("questions") if isinstance(a,dict) else None
  expected=20 if row["stage"]=="primary3" else 30
  if not a.get("sourcePdfId") or not a.get("sourcePage") or not a.get("sourceSha256"):c["missing_source"]+=1
  if not isinstance(questions,list) or len(questions)!=expected:c["missing_question_detail"]+=1
  if row.get("gender") not in ("بنين","بنات"):c["missing_gender"]+=1
  if isinstance(questions,list) and len(questions)==expected:
   awarded=[q.get("awarded") for q in questions if isinstance(q,dict)]
   if len(awarded)==expected and all(str(x) in ("0","1") for x in awarded) and row.get("score") is not None:
    if sum(int(x) for x in awarded)!=int(row["score"]):c["score_mismatch"]+=1
  if (a.get("sourcePdfId") and a.get("sourcePage") and a.get("sourceSha256") and isinstance(questions,list) and len(questions)==expected and row.get("gender") in ("بنين","بنات")):c["provenance_complete"]+=1
 if len(batch)<1000:break
 else:continue
 break
output={"mode":"read_only","writes":0,"stages":{k:dict(v) for k,v in summary.items()}}
pathlib.Path("reports").mkdir(exist_ok=True)
pathlib.Path("reports/nafs-verified-integrity.json").write_text(json.dumps(output,ensure_ascii=False,indent=2))
print(json.dumps(output,ensure_ascii=False))
