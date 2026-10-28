import {NextRequest,NextResponse} from 'next/server';
import * as XLSX from 'xlsx';
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
  const school=meta.name.replace(/^نتائج[-\s]*/,'').replace(/\.xlsx$/i,'').trim();
  const rows=matrix.slice(headerIdx+1).map((row,i)=>{
   const get=(k:string)=>indices[k]<0?'':String(row[indices[k]]??'').trim();
   const score=get('score'),total=get('total'),validScore=score!==''&&Number.isFinite(Number(score)),validTotal=total!==''&&Number.isFinite(Number(total));
   const rowWarnings=(!get('name')||!validScore||!validTotal||Number(score)<0||Number(total)<=0||Number(score)>Number(total)||/تحتاج مراجعة/.test(get('status')));
   if(get('reason'))warnings.push('صف '+(headerIdx+i+2)+': '+get('reason'));
   const answers={subjects:{arabic:get('subjectArabic')||null,math:get('subjectMath')||null,science:get('subjectScience')||null},sourceStatus:get('status'),reviewReason:get('reason')};
   if(rowWarnings)warnings.push('صف '+(headerIdx+i+2)+' يحتاج تحقق');
   return {row_number:headerIdx+i+2,student_name:get('name')||null,civil_id:get('civil')||null,school_name:school,stage,gender:get('gender')||null,score:validScore?Number(score):null,total:validTotal?Number(total):null,answers,status:'pending_review'};
  }).filter(r=>r.student_name||r.civil_id||r.score!==null);
  if(rows.length>5000)throw Error('عدد الصفوف يتجاوز الحد الآمن');
  const imported=await db.from('nafs_result_imports').insert({drive_file_id:fileId,stage,school_name:school,modified_time:meta.modifiedTime,row_count:rows.length,warnings:[...new Set(warnings)].slice(0,200),status:'pending_review'}).select('id').single();
  if(imported.error)throw imported.error;
  for(let i=0;i<rows.length;i+=300){
   const batch=await db.from('nafs_result_import_rows').insert(rows.slice(i,i+300).map(r=>({...r,import_id:imported.data.id})));
   if(batch.error){await db.from('nafs_result_imports').delete().eq('id',imported.data.id);throw batch.error}
  }
  return NextResponse.json({importId:imported.data.id,school,stage,rows:rows.length,warnings:[...new Set(warnings)].slice(0,30),status:'pending_review',message:'تم الاستيراد إلى منطقة مراجعة منفصلة، ولم تتغير النتائج المعتمدة'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'فشل الاستيراد'},{status:500})}
}