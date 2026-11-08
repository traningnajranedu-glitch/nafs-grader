import {NextRequest,NextResponse} from 'next/server';
import {Zip,ZipPassThrough,strToU8} from 'fflate';
import {requireAdmin,serviceDb} from '../../../../../lib/google-drive-server';
import {iterateLatestVerifiedRows,stageLabels,subjectLabels,questionRecords,subjectTotals} from '../../../../../lib/individual-results';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const stages=['primary3','primary6','middle3'];
const clean=(v:any)=>v===null||v===undefined?'':v;
const pct=(score:any,total:any)=>score!==null&&score!==undefined&&score!==''&&Number(total)>0?Math.round((Number(score)/Number(total))*10000)/100:'';
const xml=(v:any)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const col=(n:number)=>{let s='';while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;};
const cell=(ref:string,value:any)=>{
 if(value===null||value===undefined||value==='')return '';
 if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"><v>${value}</v></c>`;
 return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
};
const rowXml=(n:number,values:any[])=>`<row r="${n}">${values.map((v,i)=>cell(col(i+1)+n,v)).join('')}</row>`;
const sheetHead='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>';
const sheetTail='</sheetData></worksheet>';
const addStatic=(zip:Zip,path:string,body:string)=>{
 const f=new ZipPassThrough(path);zip.add(f);f.push(strToU8(body),true);
};

export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const db=serviceDb();
  const {data:skillRows,error:skillError}=await db.from('nafs_question_skills').select('stage,gender,subject,question_number,skill_code,skill_name');
  if(skillError)throw skillError;
  const skillMap=new Map<string,any>();
  for(const s of skillRows||[]){
   const k=[s.stage,s.gender||'',s.subject,s.question_number].join('|');
   if(!skillMap.has(k))skillMap.set(k,s);
  }

  const stream=new ReadableStream<Uint8Array>({
   start(controller){
    const zip=new Zip((err,chunk,final)=>{
     if(err){controller.error(err);return;}
     if(chunk?.length)controller.enqueue(chunk);
     if(final)controller.close();
    });
    const names=['ملخص عام','جميع الطلاب','نتائج المواد','الإجابات التفصيلية','تحليل المهارات','مؤشرات المدارس'];
    const files=names.map((_,i)=>{const f=new ZipPassThrough(`xl/worksheets/sheet${i+1}.xml`);zip.add(f);f.push(strToU8(sheetHead));return f;});
    const counts:Record<string,number>={primary3:0,primary6:0,middle3:0};
    let totalStudents=0,withAnswers=0,withoutAnswers=0,mappedQuestions=0;
    let studentN=1,subjectN=1,answerN=1,skillN=1,schoolN=1;
    const skillAgg=new Map<string,{stage:string;gender:string;school:string;student:string;subject:string;skill:string;count:number;correct:number;points:number}>();
    const schoolAgg=new Map<string,{stage:string;gender:string;school:string;students:Set<string>;sum:number;count:number}>();
    const headers=[
     ['مصنف نتائج نافس 2026 الشامل'],
     ['الإدارة العامة للتعليم بنجران'],
     ['يشمل النتائج المعتمدة فقط · لا يشمل السجلات قيد المراجعة'],
     ['إجمالي سجلات الطلاب',0],
     ['ثالث ابتدائي',0],['سادس ابتدائي',0],['ثالث متوسط',0],
     ['سجلات تتوفر لها إجابات تفصيلية',0],['سجلات لا تتوفر لها إجابات تفصيلية',0],
     ['الأسئلة المرتبطة بمهارات موثقة',0],
     ['ملاحظة','تُترك بيانات المهارات فارغة أو غير مصنفة عندما لا يوجد ربط موثق للسؤال بمهارة.']
    ];
    const studentHeader=['معرّف السجل','اسم الطالب','المدرسة','المرحلة','الجنس','السجل المدني','الصف المسجل','العربية','الرياضيات','العلوم','المجموع','الدرجة القصوى','نسبة الإتقان %','حالة النتيجة'];
    const subjectHeader=['معرّف السجل','اسم الطالب','المدرسة','المرحلة','الجنس','المادة','الدرجة','الدرجة القصوى','نسبة الإتقان %'];
    const answerHeader=['معرّف السجل','اسم الطالب','المدرسة','المرحلة','الجنس','المادة','رقم السؤال','إجابة الطالب','الإجابة الصحيحة','حالة الإجابة','الدرجة','رمز المهارة','المهارة'];
    const skillHeader=['المرحلة','الجنس','المدرسة','اسم الطالب','المادة','المهارة','عدد الأسئلة','الإجابات الصحيحة','نسبة الإتقان %','مجموع الدرجات'];
    const schoolHeader=['المرحلة','الجنس','المدرسة','عدد الطلاب','متوسط الدرجة'];
    files[1].push(strToU8(rowXml(studentN++,studentHeader)));
    files[2].push(strToU8(rowXml(subjectN++,subjectHeader)));
    files[3].push(strToU8(rowXml(answerN++,answerHeader)));
    files[4].push(strToU8(rowXml(skillN++,skillHeader)));
    files[5].push(strToU8(rowXml(schoolN++,schoolHeader)));

    (async()=>{
     for(const stageKey of stages){
      for await(const r of iterateLatestVerifiedRows(stageKey)){
       const stage=stageLabels[stageKey]||stageKey;
       totalStudents++;counts[stageKey]=(counts[stageKey]||0)+1;
       const totals=subjectTotals(r);
       const by=new Map(totals.map((x:any)=>[x.key,x.value]));
       files[1].push(strToU8(rowXml(studentN++,[r.id,clean(r.student_name)||'اسم الطالب غير متوفر',clean(r.school_name),stage,clean(r.gender)||'غير محدد',clean(r.civil_id),'',by.get('arabic')??'',by.get('math')??'',by.get('science')??'',clean(r.score),clean(r.total),pct(r.score,r.total),'معتمدة'])));
       for(const s of totals)if(s.value!==''&&s.value!==null)files[2].push(strToU8(rowXml(subjectN++,[r.id,clean(r.student_name),clean(r.school_name),stage,clean(r.gender),s.label,s.value,10,pct(s.value,10)])));

       const questions=questionRecords(r);
       if(questions.length)withAnswers++;else withoutAnswers++;
       const rawQuestions=Array.isArray(r.answers?.excelSnapshot?.questions)?r.answers.excelSnapshot.questions:Array.isArray(r.answers?.questions)?r.answers.questions:[];
       const rawMap=new Map<string,any>();
       for(const raw of rawQuestions)if(raw&&raw.subject!==undefined)rawMap.set([raw.subject,Number(raw.number)].join('|'),raw);
       for(const q of questions){
        const raw=rawMap.get([q.subject,q.number].join('|'))||{};
        const sm=skillMap.get([r.stage,r.gender||'',q.subject,q.number].join('|'))||null;
        const mappedSkill=q.skillName||raw.skill_name||raw.skill||sm?.skill_name||null;
        const skill=mappedSkill||'غير مرتبط بمهارة';
        const skillCode=q.skillCode||raw.skill_code||sm?.skill_code||'';
        files[3].push(strToU8(rowXml(answerN++,[r.id,clean(r.student_name),clean(r.school_name),stage,clean(r.gender),q.subjectLabel,q.number,clean(q.choice),clean(q.correct),q.correctness,clean(q.awarded),clean(skillCode),skill])));
        if(mappedSkill){
         mappedQuestions++;
         const skey=[r.stage,r.gender||'',r.school_name||'',r.id,q.subject,skill].join('|');
         const a=skillAgg.get(skey)||{stage,gender:r.gender||'غير محدد',school:r.school_name||'',student:r.student_name||'',subject:q.subjectLabel,skill,count:0,correct:0,points:0};
         a.count++;if(q.correctness==='صحيحة')a.correct++;a.points+=Number(q.awarded)||0;skillAgg.set(skey,a);
        }
       }
       const schoolKey=[r.stage,r.gender||'',r.school_name||''].join('|');
       const sa=schoolAgg.get(schoolKey)||{stage,gender:r.gender||'غير محدد',school:r.school_name||'',students:new Set<string>(),sum:0,count:0};
       sa.students.add(r.id);if(r.score!==null&&r.score!==undefined&&r.score!==''){sa.sum+=Number(r.score);sa.count++;}schoolAgg.set(schoolKey,sa);
      }
     }
     for(const a of skillAgg.values())files[4].push(strToU8(rowXml(skillN++,[a.stage,a.gender,a.school,a.student,a.subject,a.skill,a.count,a.correct,a.count?Math.round(a.correct/a.count*10000)/100:0,a.points])));
     if(skillN===2)files[4].push(strToU8(rowXml(skillN++,['','','','','','لا تتوفر روابط موثقة بين الأسئلة والمهارات في قاعدة البيانات الحالية','','','',''])));
     for(const a of schoolAgg.values())files[5].push(strToU8(rowXml(schoolN++,[a.stage,a.gender,a.school,a.students.size,a.count?Math.round(a.sum/a.count*100)/100:''])));
     const summary=[
      ['مصنف نتائج نافس 2026 الشامل'],['الإدارة العامة للتعليم بنجران'],['يشمل النتائج المعتمدة فقط · لا يشمل السجلات قيد المراجعة'],
      ['إجمالي سجلات الطلاب',totalStudents],['ثالث ابتدائي',counts.primary3],['سادس ابتدائي',counts.primary6],['ثالث متوسط',counts.middle3],
      ['سجلات تتوفر لها إجابات تفصيلية',withAnswers],['سجلات لا تتوفر لها إجابات تفصيلية',withoutAnswers],
      ['الأسئلة المرتبطة بمهارات موثقة',mappedQuestions],
      ['ملاحظة','تُترك بيانات المهارات فارغة أو غير مصنفة عندما لا يوجد ربط موثق للسؤال بمهارة.']
     ];
     for(let i=0;i<summary.length;i++)files[0].push(strToU8(rowXml(i+1,summary[i])));
     for(const f of files)f.push(strToU8(sheetTail),true);

     addStatic(zip,'[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>');
     addStatic(zip,'_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
     addStatic(zip,'xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+names.map((n,i)=>`<sheet name="${xml(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>');
     addStatic(zip,'xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+'</Relationships>');
     addStatic(zip,'xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
     zip.end();
    })().catch(err=>{try{controller.error(err);}catch{}});
   }
  });
  const fileName='نتائج نافس 2026 - المصنف الشامل.xlsx';
  return new NextResponse(stream,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(fileName),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){
  console.error('Unified results export',e);
  return NextResponse.json({error:e instanceof Error?e.message:'تعذر إنشاء المصنف الشامل'},{status:500});
 }
}
