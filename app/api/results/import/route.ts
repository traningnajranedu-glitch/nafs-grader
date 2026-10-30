import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import * as XLSX from 'xlsx';
import {readQuestionEvidence,readSourceEvidence,retainedApproval,ImportRecord} from '../../../../lib/verified-import';
import {driveToken,requireAdmin,serviceDb} from '../../../../lib/google-drive-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const folders:Record<string,string>={primary3:'16hQnpG5q1sBlO03Qj3X0MkNogwSQ-fXR',middle3:'1vT8Ms0smuINSgn6KXuCJhEZma5VRvdbn',primary6:'1foYgnj5csR6hrrRAkI8on6iZkXv3YMe6'};
const norm=(s:unknown)=>String(s??'').trim().replace(/\s+/g,' ').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
const aliases={
 school:['المدرسة','اسم المدرسة','school','school_name'],
 name:['اسم الطالب','الطالب','student name','student_name'],
 civil:['السجل المدني','رقم الهوية','رقم الطالب','student_code','civil id'],
 score:['المجموع','الدرجة','درجة الطالب','score'],
 total:['الدرجة القصوى','الدرجة الكلية','الدرجة العظمى','total','max score'],
 gender:['جنس المدرسة','الجنس','gender'],
 status:['الحالة','status'],
 reason:['سبب المراجعة','review reason'],
 page:['صفحة PDF','source page'],
 subjectArabic:['لغتي من 10','لغتي'],
 subjectMath:['الرياضيات من 10','الرياضيات'],
 subjectScience:['العلوم من 10','العلوم'],
};
function col(headers:string[],opts:string[]){return headers.findIndex(h=>opts.some(o=>norm(h)===norm(o)))}
export async function POST(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const {fileId,stage}=await req.json();
  if(typeof fileId!=='string'||!/^[a-zA-Z0-9_-]{10,120}$/.test(fileId)||!folders[stage])return NextResponse.json({error:'ملف أو مرحلة غير صالحة'},{status:400});
  const token=await driveToken(),headers={Authorization:'Bearer '+token};
  const metaRes=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?fields=id,name,mimeType,modifiedTime,parents,size',{headers,cache:'no-store'});
  if(!metaRes.ok)throw Error('تعذر التحقق من مصدر الملف');
  const meta=await metaRes.json();
  if(!meta.parents?.includes(folders[stage])||!/\.xlsx$/i.test(meta.name)||meta.mimeType!=='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')return NextResponse.json({error:'الملف ليس Excel من مجلد المرحلة المحددة'},{status:403});
  if(Number(meta.size)>12_000_000)return NextResponse.json({error:'الملف أكبر من الحد المسموح'},{status:413});
  const db=serviceDb();
  const previous=await db.from('nafs_result_imports').select('id,row_count,status').eq('drive_file_id',fileId).eq('modified_time',meta.modifiedTime).maybeSingle();
  if(previous.error)throw previous.error;
  if(previous.data)return NextResponse.json({alreadyImported:true,...previous.data});
  const download=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?alt=media',{headers,cache:'no-store'});
  if(!download.ok)throw Error('تعذر تحميل Excel');
  const buffer=Buffer.from(await download.arrayBuffer());
  if(buffer.length>12_000_000)throw Error('حجم الملف غير مقبول');
  const workbookSha=createHash('sha256').update(buffer).digest('hex');
  const book=XLSX.read(buffer,{type:'buffer',cellDates:false,bookVBA:false,bookFiles:false});
  const sheet=book.Sheets[book.SheetNames[0]];
  if(!sheet)throw Error('الملف لا يحتوي على ورقة نتائج');
  const matrix=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',blankrows:false,raw:false});
  const headerIdx=matrix.findIndex(row=>Array.isArray(row)&&row.some(v=>aliases.name.some(a=>norm(a)===norm(v)))&&row.some(v=>aliases.score.some(a=>norm(a)===norm(v))));
  if(headerIdx<0)throw Error('لم يتم التعرف على أعمدة اسم الطالب والدرجة؛ يلزم مراجعة نموذج الملف');
  const head=(matrix[headerIdx]||[]).map(v=>String(v));
  const indices=Object.fromEntries(Object.entries(aliases).map(([k,v])=>[k,col(head,v)])) as Record<string,number>;
  const warnings:string[]=[];
  if(indices.civil<0)warnings.push('عمود السجل المدني غير موجود');
  if(indices.total<0)warnings.push('عمود الدرجة الكلية غير موجود');
  const schoolIndex=indices.school;
  const schoolValues=[...new Set(matrix.slice(headerIdx+1).map(row=>schoolIndex>=0?String(row[schoolIndex]??'').trim():'').filter(Boolean))];
  if(schoolValues.length>1)throw Error('الملف يحتوي على أكثر من مدرسة؛ يتطلب مراجعة قبل الاستيراد');
  // Many official result workbooks omit a school column. Keep the source filename as a provisional label, never as a verified school identity.
  const filenameLabel=String(meta.name).replace(/\\.xlsx$/i,'').replace(/^نتائج[-_\\s]*/,'').trim();
  const school=schoolValues[0]||filenameLabel;
  if(!school)throw Error('تعذر تحديد تسمية المدرسة من الملف');
  if(!schoolValues.length)warnings.push('اسم المدرسة مستنتج مبدئيًا من اسم ملف المصدر، ويحتاج مطابقة قبل الاعتماد');
  const rows:ImportRecord[]=matrix.slice(headerIdx+1).map((row,i)=>{
   const get=(k:string)=>indices[k]<0?'':String(row[indices[k]]??'').trim();
   const score=get('score'),total=get('total'),validScore=score!==''&&Number.isFinite(Number(score)),validTotal=total!==''&&Number.isFinite(Number(total));
   const rowWarnings=(!get('name')||!validScore||!validTotal||Number(score)<0||Number(total)<=0||Number(score)>Number(total)||/تحتاج مراجعة/.test(get('status')));
   if(get('reason'))warnings.push('صف '+(headerIdx+i+2)+': '+get('reason'));
   const answers={schemaVersion:2,sourceFileId:fileId,sourceRow:headerIdx+i+2,sourcePage:Number(get('page'))||null,excelSnapshot:{fileId,sha256:workbookSha,modifiedTime:meta.modifiedTime,rowNumber:headerIdx+i+2,page:Number(get('page'))||null},subjects:{arabic:get('subjectArabic')||null,math:get('subjectMath')||null,science:get('subjectScience')||null},sourceStatus:get('status'),reviewReason:get('reason')};
   if(rowWarnings)warnings.push('صف '+(headerIdx+i+2)+' يحتاج تحقق');
   return {row_number:headerIdx+i+2,student_name:get('name')||null,civil_id:get('civil')||null,school_name:school,stage,gender:get('gender')||null,score:validScore?Number(score):null,total:validTotal?Number(total):null,answers,status:'pending_review'};
  }).filter(r=>r.student_name||r.civil_id||r.score!==null);
  if(rows.length>5000)throw Error('عدد الصفوف يتجاوز الحد الآمن');
  let retained=0;
  // Preserve only a previously approved row with identical source and question evidence.
  // Missing evidence or any changed answer leaves the new row pending.
  if(stage==='primary3'||stage==='middle3'){
   const latest=await db.from('nafs_result_imports').select('id').eq('drive_file_id',fileId).order('modified_time',{ascending:false,nullsFirst:false}).order('imported_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
   if(latest.error)throw latest.error;
   const qsheet=book.Sheets['الإجابات']||book.Sheets['الإجابات المقروءة'],metadataSheet=book.Sheets['بيانات المعالجة'];
   const evidence=qsheet?readQuestionEvidence(XLSX.utils.sheet_to_json<unknown[]>(qsheet,{header:1,defval:'',raw:true})):new Map();
   const source=metadataSheet?readSourceEvidence(XLSX.utils.sheet_to_json<unknown[]>(metadataSheet,{header:1,defval:'',raw:true})):null;
   if(latest.data&&source&&evidence.size){
    const exam=await db.from('exams').select('id').eq('title',stage==='primary3'?'ثالث ابتدائي':'ثالث متوسط').eq('status','approved').is('deleted_at',null).maybeSingle();
    if(exam.error)throw exam.error;
    if(exam.data){
     const keyRows=await db.from('exam_questions').select('question_number,correct_option,points').eq('exam_id',exam.data.id);if(keyRows.error)throw keyRows.error;
     const keys=new Map<string,string>();for(const q of keyRows.data||[]){const offset=q.question_number>40?40:q.question_number>20?20:0;const number=q.question_number-offset;if(number>=1&&number<=10&&Number(q.points)===1)keys.set((offset===0?'arabic':offset===20?'math':'science')+':'+number,q.correct_option);}
     const previous:ImportRecord[]=[];for(let offset=0;offset<5000;offset+=1000){const batch=await db.from('nafs_result_import_rows').select('row_number,student_name,civil_id,stage,gender,score,total,status,answers').eq('import_id',latest.data.id).eq('status','verified').order('row_number').range(offset,offset+999);if(batch.error)throw batch.error;previous.push(...(batch.data||[]));if((batch.data||[]).length<1000)break;}
     const byCivil=new Map<string,ImportRecord[]>();for(const row of previous)if(row.civil_id)byCivil.set(row.civil_id,[...(byCivil.get(row.civil_id)||[]),row]);
     const counts=new Map<string,number>();for(const row of rows)if(row.civil_id)counts.set(row.civil_id,(counts.get(row.civil_id)||0)+1);
     for(const row of rows){const candidates=byCivil.get(row.civil_id||'')||[];if(candidates.length!==1||counts.get(row.civil_id||'')!==1)continue;const preserved=retainedApproval(candidates[0],row,evidence.get(Number(row.answers.sourcePage))||[],source,keys,fileId);if(preserved){row.status='verified';row.answers=preserved;retained++;}}
    }
   }
  }
  const imported=await db.from('nafs_result_imports').insert({drive_file_id:fileId,stage,school_name:school,modified_time:meta.modifiedTime,row_count:rows.length,warnings:[...new Set(warnings)].slice(0,200),status:'pending_review'}).select('id').single();
  if(imported.error)throw imported.error;
  for(let i=0;i<rows.length;i+=300){
   const batch=await db.from('nafs_result_import_rows').insert(rows.slice(i,i+300).map(r=>({...r,import_id:imported.data.id})));
   if(batch.error){await db.from('nafs_result_imports').delete().eq('id',imported.data.id);throw batch.error}
  }
  return NextResponse.json({importId:imported.data.id,school,stage,rows:rows.length,retainedApprovals:retained,warnings:[...new Set(warnings)].slice(0,30),status:'pending_review',message:'حُفظت النسخة الجديدة مع الاحتفاظ بالاعتمادات السابقة المتطابقة فقط؛ بقية الصفوف قيد المراجعة'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'فشل الاستيراد'},{status:500})}
}