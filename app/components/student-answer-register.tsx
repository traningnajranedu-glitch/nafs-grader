'use client';
import {useEffect,useState} from 'react';
import * as XLSX from 'xlsx';
import {supabase} from '../../lib/supabase';
import {questionLabel} from '../../lib/exam-subjects';
type Row=Record<string,any>;
const arabic=(v:unknown)=>({A:'أ',B:'ب',C:'ج',D:'د'}[String(v)]||'بدون إجابة');
export default function StudentAnswerRegister({exam,title,subject}:{exam:string;title:string;subject:string}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{let active=true;setRows([]);setError('');if(!exam||!supabase){setBusy(false);return}setBusy(true);
 async function load(){
  const db=supabase!;
  async function pages(make:()=>any){const all:Row[]=[];for(let offset=0;;offset+=500){const r=await make().range(offset,offset+499);if(r.error)throw Error(r.error.message);all.push(...(r.data||[]));if((r.data||[]).length<500)return all}}
  const [questions,submissions,scans]=await Promise.all([
   pages(()=>db.from('exam_questions').select('id,question_number').eq('exam_id',exam).order('question_number')),
   pages(()=>db.from('submissions').select('id,source,created_at,students(full_name,student_code,grade,schools(name,stage))').eq('exam_id',exam).eq('status','graded').order('id')),
   pages(()=>db.from('nafs_scanned_corrections').select('id,school_name,student_name,student_code,stage,grade,answers,corrected_at').eq('exam_id',exam).order('id'))
  ]);
  const saved:Row[]=[];
  for(let i=0;i<submissions.length;i+=100){const ids=submissions.slice(i,i+100).map(s=>s.id);saved.push(...await pages(()=>db.from('student_answers').select('submission_id,question_id,selected_option').in('submission_id',ids).order('submission_id').order('question_id')))}
  const lookup=new Map<string,Row>();for(const a of saved){const record=lookup.get(a.submission_id)||{};record[a.question_id]=a.selected_option;lookup.set(a.submission_id,record)}
  const record=(s:Row,scan:boolean)=>{const r:Row={'رقم الحفظ':s.id,'الاختبار':title,'المدرسة':scan?s.school_name:s.students?.schools?.name,'اسم الطالب':scan?s.student_name:s.students?.full_name,'السجل المدني':String((scan?s.student_code:s.students?.student_code)||''),'المرحلة':scan?s.stage:s.students?.schools?.stage,'الصف':scan?s.grade:s.students?.grade,'المصدر':scan?'تصحيح ورقي':s.source==='online'?'إلكتروني':s.source==='excel'?'Excel':'تصحيح ورقي','وقت الحفظ':new Date(scan?s.corrected_at:s.created_at).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'})};for(const q of questions){const label=questionLabel(subject,q.question_number);r[label.subject+' — س'+label.number]=arabic(scan?s.answers?.[q.question_number]:lookup.get(s.id)?.[q.id])}return r};
  const result=[...submissions.map(s=>record(s,false)),...scans.map(s=>record(s,true))];if(active)setRows(result);
 }
 void load().catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false};
 },[exam,title,subject,version]);
 function download(){const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(rows);ws['!cols']=Object.keys(rows[0]||{}).map(()=>({wch:24}));wb.Workbook={Views:[{RTL:true}]};XLSX.utils.book_append_sheet(wb,ws,'إجابات الطلاب');XLSX.writeFile(wb,'nafs-student-answers.xlsx')}
 const headers=Object.keys(rows[0]||{});
 return <section className="student-exam-card"><h2>سجل إجابات الطلاب المعتمدة</h2><p>الإجابات محفوظة في قاعدة البيانات عند الاعتماد. يعرض السجل إجابات الاختبار المحدد، ويصدرها إلى Excel بالأحرف العربية.</p><button className="action" disabled={!exam||busy} onClick={()=>setVersion(v=>v+1)}>تحديث الإجابات</button>{' '}<button className="action" disabled={busy||!!error||!rows.length} onClick={download}>تصدير إجابات الطلاب Excel</button><p role="status">{busy?'جارٍ تحميل الإجابات...':`عدد السجلات: ${rows.length}`}</p>{error&&<p role="alert">تعذر تحميل سجل الإجابات: {error}</p>}{!exam&&<p>اختر الاختبار من الأعلى.</p>}<div className="table-wrap" style={{overflow:'auto',maxHeight:520}}><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r['رقم الحفظ']}>{headers.map(h=><td key={h}>{r[h]??'—'}</td>)}</tr>)}</tbody></table></div></section>
}
