import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '../../../../../lib/google-drive-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const labels:Record<string,string>={primary3:'ثالث ابتدائي',primary6:'سادس ابتدائي',middle3:'ثالث متوسط'};
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));const {data,error,count}=await serviceDb().from('nafs_individual_excel_downloads').select('downloaded_at,stage,school_name,gender,student_count,file_name',{count:'exact'}).in('stage',['primary3','primary6','middle3']).order('downloaded_at',{ascending:false}).limit(5000);
  if(error)throw error;const rows=data||[];const today=new Date();today.setHours(0,0,0,0);const monthStart=new Date(today.getFullYear(),today.getMonth(),1);const schoolMap=new Map<string,{school:string;stage:string;count:number}>();
  for(const row of rows){const key=row.stage+'|'+row.school_name;const item=schoolMap.get(key)||{school:row.school_name,stage:labels[row.stage]||row.stage,count:0};item.count++;schoolMap.set(key,item);}
  return NextResponse.json({total:count||0,today:rows.filter(x=>new Date(x.downloaded_at)>=today).length,thisMonth:rows.filter(x=>new Date(x.downloaded_at)>=monthStart).length,byStage:Object.keys(labels).map(stage=>({stage,label:labels[stage],count:rows.filter(x=>x.stage===stage).length})),topSchools:[...schoolMap.values()].sort((a,b)=>b.count-a.count).slice(0,10),recent:rows.slice(0,15).map(x=>({at:x.downloaded_at,stage:labels[x.stage]||x.stage,school:x.school_name,gender:x.gender||'الجميع',students:x.student_count,file:x.file_name})),limited:rows.length>=5000},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر تحميل إحصاءات التنزيل'},{status:403});}
}
export async function POST(req:NextRequest){
 try{
  const userId=await requireAdmin(req.headers.get('authorization'));const body=await req.json();const stage=String(body.stage||''),school=String(body.school||'').trim(),gender=String(body.gender||''),studentCount=Number(body.studentCount);
  if(!labels[stage]||!school||school.length>180||!['','بنين','بنات'].includes(gender)||!Number.isInteger(studentCount)||studentCount<1||studentCount>10000)return NextResponse.json({error:'بيانات التنزيل غير صالحة'},{status:400});
  const safe=school.replace(/[\\/:*?"<>|]/g,'-').slice(0,80);const {error}=await serviceDb().from('nafs_individual_excel_downloads').insert({downloaded_by:userId,stage,school_name:school,gender,student_count:studentCount,file_name:'نتائج نافس - '+safe+'.xlsx',outcome:'generated'});if(error)throw error;
  return NextResponse.json({ok:true},{status:201});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر تسجيل التنزيل'},{status:403});}
}
