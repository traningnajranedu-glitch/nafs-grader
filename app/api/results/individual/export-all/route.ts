import {NextRequest,NextResponse} from 'next/server';
import * as XLSX from 'xlsx';
import {requireAdmin,serviceDb} from '../../../../../lib/google-drive-server';
import {latestVerifiedRows,stageLabels,subjectLabels,questionRecords,subjectTotals} from '../../../../../lib/individual-results';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const stages=['primary3','primary6','middle3'];
const clean=(v:any)=>v===null||v===undefined?'':v;
const pct=(score:any,total:any)=>Number(total)>0?Math.round((Number(score)/Number(total))*10000)/100:'';

export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const all:any[]=[];
  for(const stage of stages){
   const rows=await latestVerifiedRows(stage);
   all.push(...rows.map(r=>({...r,stage:stage})));
  }
  if(!all.length)return NextResponse.json({error:'لا توجد نتائج معتمدة قابلة للتصدير في المراحل المحددة'},{status:404});

  const db=serviceDb();
  const {data:skillRows,error:skillError}=await db.from('nafs_question_skills').select('stage,gender,subject,question_number,skill_code,skill_name');
  if(skillError)throw skillError;
  const skillMap=new Map<string,any>();
  for(const s of skillRows||[]){
   const k=[s.stage,s.gender||'',s.subject,s.question_number].join('|');
   if(!skillMap.has(k))skillMap.set(k,s);
  }
  const wb=XLSX.utils.book_new();
  wb.Workbook={Views:[{RTL:true}]};
  const add=(name:string,rows:any[][],widths:number[])=>{
   const ws=XLSX.utils.aoa_to_sheet(rows);
   ws['!cols']=widths.map(w=>({wch:w}));
   ws['!views']=[{rightToLeft:true,state:'frozen',ySplit:1}];
   if(rows.length>1)ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:rows[0].length-1}})};
   XLSX.utils.book_append_sheet(wb,ws,name);
  };

  const studentRows:any[][]=[['معرّف السجل','اسم الطالب','المدرسة','المرحلة','الجنس','السجل المدني','الصف المسجل','العربية','الرياضيات','العلوم','المجموع','الدرجة القصوى','نسبة الإتقان %','حالة النتيجة']];
  const subjectRows:any[][]=[['معرّف السجل','اسم الطالب','المدرسة','المرحلة','الجنس','المادة','الدرجة','الدرجة القصوى','نسبة الإتقان %']];
  const answerRows:any[][]=[['معرّف السجل','اسم الطالب','المدرسة','المرحلة','الجنس','المادة','رقم السؤال','إجابة الطالب','الإجابة الصحيحة','حالة الإجابة','الدرجة','رمز المهارة','المهارة']];
  const skillAgg=new Map<string,{stage:string;gender:string;school:string;student:string;subject:string;skill:string;count:number;correct:number;points:number}>();
  const schoolAgg=new Map<string,{stage:string;gender:string;school:string;students:Set<string>;sum:number;count:number}>();

  for(const r of all){
   const stage=stageLabels[r.stage]||r.stage;
   const totals=subjectTotals(r);
   const by=new Map(totals.map((x:any)=>[x.key,x.value]));
   const score=Number(r.score)||0;
   studentRows.push([r.id,clean(r.student_name)||'اسم الطالب غير متوفر',clean(r.school_name),stage,clean(r.gender)||'غير محدد',clean(r.civil_id),stage,by.get('arabic')??'',by.get('math')??'',by.get('science')??'',clean(r.score),clean(r.total),pct(r.score,r.total),'معتمدة']);
   for(const s of totals){
    if(s.value!==''&&s.value!==null){
     subjectRows.push([r.id,clean(r.student_name),clean(r.school_name),stage,clean(r.gender),s.label,s.value,10,pct(s.value,10)]);
    }
   }
   const questions=questionRecords(r);
   const rawQuestions=Array.isArray(r.answers?.excelSnapshot?.questions)?r.answers.excelSnapshot.questions:Array.isArray(r.answers?.questions)?r.answers.questions:[];
   for(const q of questions){
    const raw=rawQuestions.find((x:any)=>x&&x.subject===q.subject&&Number(x.number)===q.number)||{};
    const sm=skillMap.get([r.stage,r.gender||'',q.subject,q.number].join('|'))||null;
    const skill=q.skillName||raw.skill_name||raw.skill||sm?.skill_name||'غير مصنف';
    const skillCode=q.skillCode||raw.skill_code||sm?.skill_code||'';
    answerRows.push([r.id,clean(r.student_name),clean(r.school_name),stage,clean(r.gender),q.subjectLabel,q.number,clean(q.choice),clean(q.correct),q.correctness,clean(q.awarded),clean(skillCode),skill]);
    const skey=[r.stage,r.gender||'',r.school_name||'',r.id,q.subject,skill].join('|');
    const a=skillAgg.get(skey)||{stage,gender:r.gender||'غير محدد',school:r.school_name||'',student:r.student_name||'',subject:q.subjectLabel,skill,count:0,correct:0,points:0};
    a.count++;if(q.correctness==='صحيحة')a.correct++;a.points+=Number(q.awarded)||0;skillAgg.set(skey,a);
   }
   const schoolKey=[r.stage,r.gender||'',r.school_name||''].join('|');
   const sa=schoolAgg.get(schoolKey)||{stage,gender:r.gender||'غير محدد',school:r.school_name||'',students:new Set<string>(),sum:0,count:0};
   sa.students.add(r.id);if(Number.isFinite(Number(r.score))){sa.sum+=Number(r.score);sa.count++;}schoolAgg.set(schoolKey,sa);
  }
  const skillRowsOut:any[][]=[['المرحلة','الجنس','المدرسة','اسم الطالب','المادة','المهارة','عدد الأسئلة','الإجابات الصحيحة','نسبة الإتقان %','مجموع الدرجات']];
  for(const a of skillAgg.values())skillRowsOut.push([a.stage,a.gender,a.school,a.student,a.subject,a.skill,a.count,a.correct,a.count?Math.round(a.correct/a.count*10000)/100:0,a.points]);
  const schoolRows:any[][]=[['المرحلة','الجنس','المدرسة','عدد الطلاب','متوسط الدرجة']];
  for(const a of schoolAgg.values())schoolRows.push([a.stage,a.gender,a.school,a.students.size,a.count?Math.round(a.sum/a.count*100)/100:'']);
  const summary:any[][]=[
   ['مصنف نتائج نافس 2026 الشامل'],
   ['الإدارة العامة للتعليم بنجران'],
   ['يشمل النتائج المعتمدة فقط · لا يشمل السجلات قيد المراجعة'],
   ['إجمالي سجلات الطلاب',all.length],
   ['ثالث ابتدائي',all.filter(x=>x.stage==='primary3').length],
   ['سادس ابتدائي',all.filter(x=>x.stage==='primary6').length],
   ['ثالث متوسط',all.filter(x=>x.stage==='middle3').length],
   ['سجلات تتوفر لها إجابات تفصيلية',all.filter(x=>questionRecords(x).length>0).length],
   ['سجلات لا تتوفر لها إجابات تفصيلية',all.filter(x=>questionRecords(x).length===0).length],
   ['ملاحظة','تُترك بيانات المهارات فارغة أو غير مصنفة عندما لا يوجد ربط موثق للسؤال بمهارة.']
  ];
  const ws0=XLSX.utils.aoa_to_sheet(summary);ws0['!cols']=[{wch:48},{wch:28}];ws0['!views']=[{rightToLeft:true}];XLSX.utils.book_append_sheet(wb,ws0,'ملخص عام');
  add('جميع الطلاب',studentRows,[38,30,30,18,14,20,14,14,14,14,14,16,18,14]);
  add('نتائج المواد',subjectRows,[38,30,30,18,14,20,14,16,18]);
  add('الإجابات التفصيلية',answerRows,[38,30,30,18,14,20,12,14,14,16,12,16,32]);
  add('تحليل المهارات',skillRowsOut,[18,14,30,30,20,34,14,16,18,14]);
  add('مؤشرات المدارس',schoolRows,[18,14,32,14,18]);
  const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx',cellStyles:true});
  const fileName='نتائج نافس 2026 - المصنف الشامل.xlsx';
  return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(fileName),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('Unified results export',e);return NextResponse.json({error:e instanceof Error?e.message:'تعذر إنشاء المصنف الشامل'},{status:500});}
}
