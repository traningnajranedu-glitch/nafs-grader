import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '../../../../lib/google-drive-server';
import {latestVerifiedRows,stageLabels,questionRecords,subjectTotals} from '../../../../lib/individual-results';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const p=req.nextUrl.searchParams,stage=p.get('stage')||'',mode=p.get('mode')||'schools',gender=p.get('gender')||'',school=p.get('school')||'';
  if(!stageLabels[stage]||!['','بنين','بنات'].includes(gender))return NextResponse.json({error:'حدد مرحلة وجنسًا صحيحين'},{status:400});
  const rows=await latestVerifiedRows(stage,undefined,gender||undefined);
  if(mode==='schools'){
   const map=new Map<string,{school:string;students:number;withQuestions:number;gender:string}>();
   for(const r of rows){const name=(r.school_name||'').replace(/\\.xlsx?$/i,'').trim()||'اسم مدرسة غير متوفر';const key=name+'|'+(r.gender||'غير محدد');const item=map.get(key)||{school:name,students:0,withQuestions:0,gender:r.gender||'غير محدد'};item.students++;if(questionRecords(r).length)item.withQuestions++;map.set(key,item);}
   return NextResponse.json({stage,stageLabel:stageLabels[stage],schools:[...map.values()].sort((a,b)=>a.school.localeCompare(b.school,'ar'))},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(mode!=='school'||!school)return NextResponse.json({error:'حدد المدرسة المطلوبة'},{status:400});
  const norm=(v:string)=>(v||'').replace(/\\.xlsx?$/i,'').replace(/[أإآ]/g,'ا').replace(/\\s+/g,' ').trim();
  const selected=rows.filter(r=>norm(r.school_name||'')===norm(school));
  const students=selected.map(r=>({id:r.id,name:r.student_name||'اسم الطالب غير متوفر',civilId:r.civil_id||'',grade:stageLabels[stage],gender:r.gender||'غير محدد',score:r.score,total:r.total,subjects:subjectTotals(r),questions:questionRecords(r)}));
  return NextResponse.json({stage,stageLabel:stageLabels[stage],school,gender:gender||null,students,summary:{students:students.length,withQuestions:students.filter(x=>x.questions.length).length,withoutQuestions:students.filter(x=>!x.questions.length).length}},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('Individual results API',e);return NextResponse.json({error:e instanceof Error?e.message:'تعذر تحميل النتائج الفردية'},{status:500})}
}
