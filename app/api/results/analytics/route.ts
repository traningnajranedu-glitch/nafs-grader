import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '../../../../lib/google-drive-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Row={school_name:string;stage:string;gender:string|null;score:number|null;total:number|null;status:string;answers:unknown};
const normalize=(s:string)=>s.trim().replace(/\s+/g,' ').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const db=serviceDb();
  const {data:imports,error:ie}=await db.from('nafs_result_imports').select('id,drive_file_id,stage,school_name,modified_time,row_count,status').order('modified_time',{ascending:false}).limit(2000);
  if(ie)throw ie;
  const latest=new Map<string,(typeof imports)[number]>();
  for(const item of imports||[])if(!latest.has(item.drive_file_id))latest.set(item.drive_file_id,item);
  const current=[...latest.values()];
  const summary=new Map<string,{stage:string;school:string;files:number;students:number;scored:number;verified:number;pending:number;sum:number;mastered:number;boys:number;girls:number}>();
  let scanned=0;
  for(const item of current){
   const key=item.stage+'|'+normalize(item.school_name);
   const agg=summary.get(key)||{stage:item.stage,school:item.school_name,files:0,students:0,scored:0,verified:0,pending:0,sum:0,mastered:0,boys:0,girls:0};
   agg.files++;summary.set(key,agg);
   for(let from=0;from<item.row_count;from+=1000){
    const {data:rows,error}=await db.from('nafs_result_import_rows').select('school_name,stage,gender,score,total,status,answers').eq('import_id',item.id).range(from,from+999);
    if(error)throw error;
    for(const row of rows as Row[]||[]){
     scanned++;agg.students++;
     const verified=item.status==='validated'&&row.status==='verified';
     if(verified)agg.verified++;else agg.pending++;
     if(/بنات|اناث|female/i.test(row.gender||''))agg.girls++;else if(/بنين|ذكور|male/i.test(row.gender||''))agg.boys++;
     if(row.score!==null&&row.total!==null&&Number(row.total)>0&&Number(row.score)>=0&&Number(row.score)<=Number(row.total)){
      agg.scored++;
      if(verified){const p=100*Number(row.score)/Number(row.total);agg.sum+=p;if(p>=80)agg.mastered++}
     }
    }
   }
  }
  return NextResponse.json({schools:[...summary.values()].map(s=>({...s,average:s.verified?s.sum/s.verified:null,mastery:s.verified?100*s.mastered/s.verified:null})),files:current.length,students:scanned,checkedAt:new Date().toISOString(),source:'imported Excel staging',note:'Only validated imports and verified rows count toward approved mastery; no student identifiers are returned.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر تحميل التحليلات'},{status:403})}
}