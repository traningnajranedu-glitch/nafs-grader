import {NextRequest,NextResponse} from 'next/server';
import {serviceDb} from '../../../../lib/google-drive-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  const p=req.nextUrl.searchParams;
  const stage=p.get('stage'),gender=p.get('gender'),subject=p.get('subject');
  if(stage&&!['primary3','primary6','middle3'].includes(stage)||gender&&!['بنين','بنات'].includes(gender)||subject&&!['arabic','math','science'].includes(subject))return NextResponse.json({error:'قيمة فلتر غير صالحة'},{status:400});
  const {data,error}=await serviceDb().rpc('nafs_verified_analytics',{p_stage:stage||null,p_gender:gender||null,p_school:p.get('school')||null,p_subject:subject||null,p_skill:p.get('skill')||null});
  if(error)throw error;
  if(!data||!data.summary)throw Error('Analytics unavailable');
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('NAFS verified analytics error',e);return NextResponse.json({error:'تعذر تحميل مؤشرات النتائج المتحقق منها'},{status:500})}
}
