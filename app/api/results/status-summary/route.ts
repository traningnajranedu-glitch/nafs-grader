import {NextResponse} from 'next/server';
import {serviceDb} from '../../../../lib/google-drive-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const STAGES=['primary3','primary6','middle3'] as const;
const PAGE_SIZE=1000;

export async function GET(){
 try{
  const db=serviceDb();
  const {data:imports,error:importsError}=await db
   .from('nafs_result_imports')
   .select('id,drive_file_id,stage,modified_time,imported_at')
   .in('stage',[...STAGES])
   .order('modified_time',{ascending:false,nullsFirst:false})
   .order('imported_at',{ascending:false})
   .order('id',{ascending:false});
  if(importsError)throw importsError;

  // Match the analytics RPC: count rows only from the newest import for each Drive file.
  const latestByFile=new Map<string,{id:string;stage:string}>();
  for(const item of imports||[]){
   if(item.drive_file_id&&!latestByFile.has(item.drive_file_id)){
    latestByFile.set(item.drive_file_id,{id:item.id,stage:item.stage});
   }
  }
  const latest=[...latestByFile.values()];
  const counts:Record<string,{verified:number;pending:number;other:number;total:number}>={};
  for(const stage of STAGES)counts[stage]={verified:0,pending:0,other:0,total:0};
  const importStage=new Map(latest.map(item=>[item.id,item.stage]));

  for(let offset=0;;offset+=PAGE_SIZE){
   if(!latest.length)break;
   const pageIds=latest.map(x=>x.id);
   const {data,error}=await db.from('nafs_result_import_rows')
    .select('id,import_id,status')
    .in('import_id',pageIds)
    .order('id',{ascending:true})
    .range(offset,offset+PAGE_SIZE-1);
   if(error)throw error;
   const rows=data||[];
   for(const row of rows){
    const stage=importStage.get(row.import_id);
    if(!stage||!counts[stage])continue;
    counts[stage].total++;
    if(row.status==='verified')counts[stage].verified++;
    else if(row.status==='pending_review')counts[stage].pending++;
    else counts[stage].other++;
   }
   if(rows.length<PAGE_SIZE)break;
  }

  const byStage=STAGES.map(stage=>({stage,...counts[stage]}));
  const verified=byStage.reduce((n,x)=>n+x.verified,0);
  const pending=byStage.reduce((n,x)=>n+x.pending,0);
  const other=byStage.reduce((n,x)=>n+x.other,0);
  const total=byStage.reduce((n,x)=>n+x.total,0);
  return NextResponse.json({verified,pending,other,total,byStage,source:'latest_import_per_drive_file_all_three_stages',checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('NAFS status summary',e);
  return NextResponse.json({error:'تعذر تحميل حالات النتائج'},{status:500});
 }
}
