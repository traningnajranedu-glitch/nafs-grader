import {NextResponse} from 'next/server';
import {serviceDb} from '../../../../../lib/google-drive-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{const db=serviceDb();const [verified,pending]=await Promise.all([
db.from('nafs_result_import_rows').select('id',{count:'exact',head:true}).eq('status','verified'),
db.from('nafs_result_import_rows').select('id',{count:'exact',head:true}).eq('status','pending_review')
]);if(verified.error||pending.error)throw Error('Counts unavailable');return NextResponse.json({verified:verified.count??0,pending_review:pending.count??0,skill_mastery_ready:false,updated_at:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'تعذر تحميل أعداد السجلات'},{status:500})}}
