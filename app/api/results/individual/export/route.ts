import {NextRequest,NextResponse} from 'next/server';
import * as XLSX from 'xlsx';
import {requireAdmin,serviceDb} from '../../../../../lib/google-drive-server';
import {latestVerifiedRows,stageLabels,subjectLabels,questionRecords,subjectTotals,mathSupplement,displayedTotal} from '../../../../../lib/individual-results';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  const userId=await requireAdmin(req.headers.get('authorization'));
  const p=req.nextUrl.searchParams,stage=p.get('stage')||'',school=p.get('school')||'',gender=p.get('gender')||'';
  if(!stageLabels[stage]||!school||!['','بنين','بنات'].includes(gender))return NextResponse.json({error:'حدد المرحلة والمدرسة والجنس بصورة صحيحة'},{status:400});
  const rows=await latestVerifiedRows(stage,school,gender||undefined);
  if(!rows.length)return NextResponse.json({error:'لا توجد نتائج بحالة verified لهذه المدرسة ضمن أحدث استيراد'},{status:404});
  const wb=XLSX.utils.book_new();wb.Workbook={Views:[{RTL:true}]};
  const headers=['اسم الطالب','السجل المدني','الصف','الجنس',...Object.keys(subjectLabels).map(k=>subjectLabels[k]),'المجموع الكلي','الدرجة القصوى','رياضيات 11–20 من 10','الحد الأقصى للرياضيات'];
  const summary:any[][]=[['نتائج اختبار نافس 2026'],['الإدارة العامة للتعليم بنجران'],['المدرسة: '+school],['المرحلة: '+stageLabels[stage]+' | الجنس: '+(gender||'جميع الجنسين')],[],headers];
  for(const r of rows){const totals=subjectTotals(r),result=displayedTotal(r),supplement=mathSupplement(r);const byKey=new Map(totals.map(x=>[x.key,x.value]));summary.push([r.student_name||'اسم الطالب غير متوفر',r.civil_id||'',stageLabels[stage],r.gender||'غير محدد',byKey.get('arabic')??'',byKey.get('math')??'',byKey.get('science')??'',result.score??'',result.total??'',supplement?.score??'',totals.find(x=>x.key==='math'&&x.value!=='')?.max??'']);}
  const ws1=XLSX.utils.aoa_to_sheet(summary);ws1['!cols']=[{wch:32},{wch:20},{wch:18},{wch:14},{wch:18},{wch:18},{wch:18},{wch:18},{wch:16},{wch:22},{wch:22}];ws1['!views']=[{rightToLeft:true,state:'frozen',ySplit:6}];ws1['!autofilter']={ref:'A6:K'+summary.length};ws1['!merges']=[0,1,2,3].map(r=>({s:{r,c:0},e:{r,c:10}}));ws1['!rows']=[{hpt:30},{hpt:22},{hpt:20},{hpt:20},{hpt:8},{hpt:28}];XLSX.utils.book_append_sheet(wb,ws1,'ملخص النتائج');
  const questionSets=rows.map(r=>questionRecords(r)),subjects=Object.keys(subjectLabels).filter(k=>questionSets.some(qs=>qs.some(q=>q.subject===k)));
  const maxBySubject=new Map<string,number>();for(const k of subjects)maxBySubject.set(k,Math.max(0,...questionSets.flatMap(qs=>qs.filter(q=>q.subject===k).map(q=>q.number))));
  const fixed=['اسم الطالب','السجل المدني','الصف','الجنس'],merges:any[]=[];const groupHeader:any[]=[...fixed],detailHeader:string[]=[];let groupStart=fixed.length;
  for(const c of [0,1,2,3])merges.push({s:{r:2,c},e:{r:3,c}});
  for(const key of subjects){const count=maxBySubject.get(key)||0,width=count*3+1;groupHeader.push(subjectLabels[key]);for(let n=1;n<=count;n++)detailHeader.push('س'+n+' · الإجابة','س'+n+' · الصحة','س'+n+' · الدرجة');detailHeader.push('مجموع '+subjectLabels[key]);merges.push({s:{r:2,c:groupStart},e:{r:2,c:groupStart+width-1}});groupStart+=width;}
  groupHeader.push('المجموع الكلي');detailHeader.push('المجموع الكلي');merges.push({s:{r:2,c:groupStart},e:{r:3,c:groupStart}});
  const sheet2:any[][]=[['تفاصيل إجابات ودرجات الأسئلة'],['المدرسة: '+school+' | '+stageLabels[stage]],groupHeader,detailHeader];
  for(let i=0;i<rows.length;i++){const r=rows[i],qs=questionSets[i],line:any[]=[r.student_name||'اسم الطالب غير متوفر',r.civil_id||'',stageLabels[stage],r.gender||'غير محدد'];for(const key of subjects){const sq=qs.filter(q=>q.subject===key);for(let n=1;n<=(maxBySubject.get(key)||0);n++){const q:any=sq.find(x=>Number(x.number)===n);line.push(q?.choice??'',q?.correctness??'',q?.awarded??'');}line.push(subjectTotals(r).find(x=>x.key===key)?.value??'');}line.push(displayedTotal(r).score??'');sheet2.push(line);}
  const ws2=XLSX.utils.aoa_to_sheet(sheet2);ws2['!cols']=[{wch:30},{wch:20},{wch:18},{wch:14},...subjects.flatMap(k=>[...Array.from({length:maxBySubject.get(k)||0},()=>[{wch:13},{wch:15},{wch:12}]).flat(),{wch:18}]),{wch:18}];ws2['!views']=[{rightToLeft:true,state:'frozen',ySplit:4,xSplit:4}];ws2['!autofilter']={ref:'A4:'+XLSX.utils.encode_col(sheet2[3].length-1)+sheet2.length};ws2['!merges']=merges;ws2['!rows']=[{hpt:30},{hpt:22},{hpt:24},{hpt:34}];XLSX.utils.book_append_sheet(wb,ws2,'تفاصيل الأسئلة');
  const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx',cellStyles:true});const safe=school.replace(/[\\/:*?"<>|]/g,'-').slice(0,80);const fileName='نتائج نافس - '+safe+'.xlsx';
  const {error:logError}=await serviceDb().from('nafs_individual_excel_downloads').insert({downloaded_by:userId,stage,school_name:school,gender,student_count:rows.length,file_name:fileName,outcome:'generated'});
  if(logError)console.error('Excel download audit insert failed',logError);
  return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(fileName),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('Individual results export',e);return NextResponse.json({error:e instanceof Error?e.message:'تعذر إنشاء ملف المدرسة'},{status:500});}
}
