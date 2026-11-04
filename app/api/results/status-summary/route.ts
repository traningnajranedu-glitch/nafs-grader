import {NextResponse} from 'next/server';
import {serviceDb} from '../../../../lib/google-drive-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const db=serviceDb();
  const [verified,pending]=await Promise.all([
   db.from('nafs_result_import_rows').select('id',{count:'exact',head:true}).in('stage',['primary3','middle3']).eq('status','verified'),
   db.from('nafs_result_import_rows').select('id',{count:'exact',head:true}).in('stage',['primary3','middle3']).eq('status','pending_review')
  ]);
  if(verified.error)throw verified.error;
  if(pending.error)throw pending.error;
  return NextResponse.json({verified:verified.count??0,pending:pending.count??0,total:(verified.count??0)+(pending.count??0),source:'database_status_third_primary_middle_only',checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('NAFS status summary',e);return NextResponse.json({error:'تعذر تحميل حالات النتائج'},{status:500})}
}
