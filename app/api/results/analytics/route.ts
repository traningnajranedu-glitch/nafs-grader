import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '../../../../lib/google-drive-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const {data,error}=await serviceDb().rpc('nafs_import_school_summary');
  if(error)throw error;
  const schools=(data||[]).map((s:{stage:string;school:string;files:number;students:number;scored:number;verified:number;pending:number;average:number|null;mastery:number|null;boys:number;girls:number})=>({
   ...s,files:Number(s.files),students:Number(s.students),scored:Number(s.scored),
   candidates:Number(s.verified),verified:Number(s.verified),pending:Number(s.pending),boys:Number(s.boys),girls:Number(s.girls),
   average:s.average===null?null:Number(s.average),mastery:s.mastery===null?null:Number(s.mastery)
  }));
  return NextResponse.json({schools,files:schools.reduce((a:number,s:{files:number})=>a+s.files,0),students:schools.reduce((a:number,s:{students:number})=>a+s.students,0),checkedAt:new Date().toISOString(),source:'audited Excel staging',note:'Verified counts and mastery include only audited rows linked to source evidence; pending rows are excluded.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('NAFS analytics error',e);return NextResponse.json({error:e instanceof Error?e.message:'تعذر تحميل التحليلات'},{status:500})}
}