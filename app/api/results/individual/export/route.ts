import {NextRequest,NextResponse} from 'next/server';
import * as XLSX from 'xlsx';
import {requireAdmin} from '../../../../../lib/google-drive-server';
import {latestVerifiedRows,stageLabels,subjectLabels,questionRecords,subjectTotals} from '../../../../../lib/individual-results';
export const runtime='nodejs';export const dynamic='force-dynamic';
const colors:Record<string,string>={arabic:'D9F0E9',math:'E5EFF9',science:'FFF0D7'};
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const p=req.nextUrl.searchParams,stage=p.get('stage')||'',school=p.get('school')||'',gender=p.get('gender')||'';
  if(!stageLabels[stage]||!school||!['','بنين','بنات'].includes(gender))return NextResponse.json({error:'حدد المرحلة والمدرسة والجنس بصورة صحيحة'},{status:400});
  const rows=await latestVerifiedRows(stage,school,gender||undefined);
  if(!rows.length)return NextResponse.json({error:'لا توجد نتائج بحالة verified لهذه المدرسة ضمن أحدث استيراد'},{status:404});
  const wb=XLSX.utils.book_new();wb.Workbook={Views:[{RTL:true}]};
  const headers=['اسم الطالب','السجل المدني','الصف','الجنس',...Object.keys(subjectLabels).map(k=>subjectLabels[k]),'المجموع الكلي'];
  const summary:any[][]=[['نتائج اختبار نافس 2026'],['الإدارة العامة للتعليم بنجران'],['المدرسة: '+school],['المرحلة: '+stageLabels[stage]+' | الجنس: '+(gender||'جميع الجنسين')],[],headers];
  for(const r of rows){const subjects=subjectTotals(r);const byKey=new Map(subjects.map(x=>[x.key,x.value]));summary.push([r.student_name||'اسم الطالب غير متوفر',r.civil_id||'',stageLabels[stage],r.gender||'غير محدد',byKey.get('arabic')??'',byKey.get('math')??'',byKey.get('science')??'',r.score??'']);}
  const ws1=XLSX.utils.aoa_to_sheet(summary);ws1['!cols']=[{wch:32},{wch:20},{wch:18},{wch:14},{wch:18},{wch:18},{wch:18},{wch:18}];ws1['!views']=[{rightToLeft:true,state:'frozen',ySplit:6}];ws1['!autofilter']={ref:'A6:H'+(summary.length)};ws1['!merges']=[{s:{r:0,c:0},e:{r:0,c:7}},{s:{r:1,c:0},e:{r:1,c:7}},{s:{r:2,c:0},e:{r:2,c:7}},{s:{r:3,c:0},e:{r:3,c:7}}];ws1['!rows']=[{hpt:30},{hpt:22},{hpt:20},{hpt:20},{hpt:8},{hpt:28}];XLSX.utils.book_append_sheet(wb,ws1,'ملخص النتائج');
  const questionSets=rows.map(r=>questionRecords(r));const subjects=Object.keys(subjectLabels).filter(k=>questionSets.some(qs=>qs.some(q=>q.subject===k)));
  const maxBySubject=new Map<string,number>();for(const k of subjects)maxBySubject.set(k,Math.max(0,...questionSets.flatMap(qs=>qs.filter(q=>q.subject===k).map(q=>q.number))));
  const fixed=['اسم الطالب','السجل المدني','الصف','الجنس'];const qHeaders:string[]=[];const merges:any[]=[];let col=fixed.length;
  for(const key of subjects){const count=maxBySubject.get(key)||0;const start=col;for(let n=1;n<=count;n++){qHeaders.push('س'+n+' - الإجابة المختارة','س'+n+' - صحة الإجابة','س'+n+' - درجة السؤال');col+=3;}qHeaders.push('مجموع '+subjectLabels[key]);col++;}
  qHeaders.push('المجموع الكلي');const groupHeader:any[]=[...fixed];const detailHeader:string[]=[];for(const key of subjects){groupHeader.push(subjectLabels[key]);for(let n=1;n<=(maxBySubject.get(key)||0);n++)detailHeader.push('س'+n+' · الإجابة','س'+n+' · الصحة','س'+n+' · الدرجة');detailHeader.push('مجموع '+subjectLabels[key]);}groupHeader.push('المجموع الكلي');detailHeader.push('المجموع الكلي');const sheet2:any[][]=[['تفاصيل إجابات ودرجات الأسئلة'],['المدرسة: '+school+' | '+stageLabels[stage]],groupHeader,detailHeader];
  for(let c=0;c<fixed.length;c++)merges.push({s:{r:2,c},e:{r:3,c}});let groupStart=fixed.length;for(const key of subjects){const width=(maxBySubject.get(key)||0)*3+1;merges.push({s:{r:2,c:groupStart},e:{r:2,c:groupStart+width-1}});groupStart+=width;}merges.push({s:{r:2,c:groupStart},e:{r:3,c:groupStart}});
  for(let i=0;i<rows.length;i++){const r=rows[i],qs=questionSets[i];const line:any[]=[r.student_name||'اسم الطالب غير متوفر',r.civil_id||'',stageLabels[stage],r.gender||'غير محدد'];for(const key of subjects){const subjectQs=qs.filter(q=>q.subject===key);for(let n=1;n<=(maxBySubject.get(key)||0);n++){const q:any=subjectQs.find((item:any)=>Number(item.number)===n);line.push(q?.choice??'',q?.correctness??'',q?.awarded??'');}const total=subjectTotals(r).find(x=>x.key===key)?.value??'';line.push(total);}line.push(r.score??'');sheet2.push(line);}
  const ws2=XLSX.utils.aoa_to_sheet(sheet2);ws2['!cols']=[{wch:30},{wch:20},{wch:18},{wch:14},...subjects.flatMap(k=>[...Array.from({length:(maxBySubject.get(k)||0)},()=>[{wch:13},{wch:15},{wch:12}]).flat(),{wch:18}]),{wch:18}];ws2['!views']=[{rightToLeft:true,state:'frozen',ySplit:4,xSplit:4}];ws2['!autofilter']={ref:'A4:'+XLSX.utils.encode_col(sheet2[3].length-1)+(sheet2.length)};ws2['!merges']=merges;ws2['!rows']=[{hpt:30},{hpt:22},{hpt:24},{hpt:34}];XLSX.utils.book_append_sheet(wb,ws2,'تفاصيل الأسئلة');
  for(const ws of [ws1,ws2]){for(const address of Object.keys(ws)){if(address[0]==='!')continue;const cell=ws[address] as any;if(cell.v!==undefined&&typeof cell.v==='number')cell.z='0.##';}}
  const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx',cellStyles:true});const safe=school.replace(/[\\/:*?"<>|]/g,'-').slice(0,80);
  return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent('نتائج نافس - '+safe+'.xlsx'),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('Individual results export',e);return NextResponse.json({error:e instanceof Error?e.message:'تعذر إنشاء ملف المدرسة'},{status:500})}
}
