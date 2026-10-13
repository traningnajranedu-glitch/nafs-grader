'use client';
import {useEffect,useRef,useState} from 'react';
import * as XLSX from 'xlsx';
import {supabase} from '../../lib/supabase';
import JsBarcode from 'jsbarcode';
type Student={code:string;name:string;grade:string;section:string};
type School={id:string;name:string};
const field={padding:'11px 12px',border:'1px solid #cbd5e1',borderRadius:9,minWidth:180,maxWidth:'100%'} as const;
const button={background:'#087e83',color:'#fff',border:0,borderRadius:9,padding:'12px 20px',cursor:'pointer'} as const;
const choices=['د','ج','ب','أ'];
function Barcode({value}:{value:string}){const svg=useRef<SVGSVGElement>(null);useEffect(()=>{if(svg.current&&value){try{JsBarcode(svg.current,value,{format:'CODE128',width:1.5,height:46,displayValue:true,fontSize:12,margin:0,textMargin:3})}catch{svg.current.replaceChildren()}}},[value]);return <svg ref={svg} className="student-barcode" aria-label={'باركود رقم الطالب '+value}/>}
function Cell({n}:{n:number}){return <div className="answer-line"><span className="question-no">{n}</span>{['أ','ب','ج','د'].map(c=><span className="bubble" key={c}>{c}</span>)}</div>}
function Paper({student,schoolName,counts}:{student:Student;schoolName:string;counts:number[]}){
return <article className="answer-paper">
<span className="mark m1"/><span className="mark m2"/><span className="mark m3"/><span className="mark m4"/>
<div className="reference-header">
<div className="reference-school"><div className="education-sign"><div className="education-dots">● ● ●<br/> ● ● ● ●<br/> ● ● ●</div><strong>وزارة التعليم</strong><small>Ministry of Education</small></div><h2>{schoolName||'اسم المدرسة'}</h2><h3>{student.name}</h3>{student.grade&&<p>{student.grade} {student.section&&'— '+student.section}</p>}</div>
<div className="reference-barcode"><Barcode value={student.code}/><p>نموذج الاختبار</p><div className="example-bubbles">{['أ','ب','ج','د'].map(x=><span key={x}>{x}</span>)}</div><div className="mark-guide"><div><b>تظليل خطأ</b><p>◉ ◯ ◐ ✕ ◉</p><small>Incorrect Marks</small></div><div><b>التظليل الصحيح</b><p>●</p><small>Correct Mark</small></div></div></div>
</div>
<div className="identity-line"><span>{schoolName}</span><strong>{student.code}</strong></div>
<div className="subjects">{['لغتي','رياضيات','علوم'].map((subject,i)=><section className="subject" key={subject}><h4 className="subject-title">{subject}</h4><div className="subject-rows">{Array.from({length:counts[i]},(_,j)=><Cell key={j} n={j+1}/>)}</div></section>)}</div>
<footer className="paper-footer">ورقة إجابة اختبار نافس — يُرجى تظليل دائرة واحدة لكل سؤال بقلم واضح</footer>
</article>
}
export default function Sheets(){
const [user,setUser]=useState(''),[schools,setSchools]=useState<School[]>([]),[school,setSchool]=useState(''),[students,setStudents]=useState<Student[]>([]),[counts,setCounts]=useState([20,20,20]),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(0);
const papers=useRef<HTMLDivElement>(null);
useEffect(()=>{if(!supabase)return;supabase.auth.getUser().then(r=>setUser(r.data.user?.email||''));const {data}=supabase.auth.onAuthStateChange((_,s)=>setUser(s?.user?.email||''));return()=>data.subscription.unsubscribe()},[]);
useEffect(()=>{if(!user||!supabase)return;Promise.all([supabase.from('system_admins').select('user_id'),supabase.from('user_school_roles').select('school_id,schools(id,name)')]).then(async ([admin,roles])=>{if(admin.data?.length){const r=await supabase.from('schools').select('id,name').order('name');if(r.error){setStatus(r.error.message);return}setSchools(r.data||[]);setSchool(r.data?.[0]?.id||'')}else{const s=(roles.data||[]).map((x:any)=>x.schools).filter(Boolean);setSchools(s);setSchool(s[0]?.id||'')}})},[user]);
function readStudents(file:File){setStatus('');file.arrayBuffer().then(buffer=>{
const book=XLSX.read(buffer,{type:'array',cellText:true});const sheet=book.Sheets[book.SheetNames[0]];
const grid=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',raw:false}) as unknown[][];
const clean=(v:unknown)=>String(v??'').trim().replace(/[\u0660-\u0669]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[\u06F0-\u06F9]/g,d=>String(d.charCodeAt(0)-0x6f0)).replace(/\s+/g,' ');
const normalize=(v:unknown)=>clean(v).replace(/\s/g,'').replace(/ـ/g,'');
let header=-1,nameCol=-1,codeCol=-1;
for(let i=0;i<Math.min(grid.length,25);i++){const row=grid[i]||[];const n=row.findIndex(v=>['اسمالطالب','الطالب'].includes(normalize(v)));const id=row.findIndex(v=>['رقمالطالب','رقمالهوية','السجلالمدني'].includes(normalize(v)));if(n>=0&&id>=0&&n!==id){header=i;nameCol=n;codeCol=id;break}}
if(header<0){setStatus('لم يتم العثور على عمودي اسم الطالب ورقم الطالب. تأكد من وجود صف عناوين مثل الصورة المرفقة.');return}
const parsed:Student[]=[];for(let i=header+1;i<grid.length;i++){const row=grid[i]||[];const name=clean(row[nameCol]);const code=clean(row[codeCol]).replace(/\s/g,'');if(!name&&!code)continue;if(!name||!code){setStatus('بيانات ناقصة في صف Excel رقم '+(i+1));return}parsed.push({name,code,grade:'',section:''})}
if(!parsed.length){setStatus('لا توجد أسماء طلاب أسفل صف العناوين');return}
if(new Set(parsed.map(s=>s.code)).size!==parsed.length){setStatus('توجد أرقام طلاب مكررة في الملف');return}
if(parsed.length>250){setStatus('الحد الأقصى للدفعة الواحدة 250 طالبًا');return}
setStudents(parsed);setPreview(0);setStatus('تم استيراد '+parsed.length+' طالبًا بنجاح من تنسيق الملف المدرسي')
}).catch(()=>setStatus('تعذر قراءة ملف Excel'))}
function template(){const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([['','مدرسة: اسم المدرسة',''],['','اسم الطالب','رقم الطالب'],['','طالب تجريبي','1000000001']]);ws['C3'].t='s';ws['!cols']=[{wch:4},{wch:38},{wch:20}];XLSX.utils.book_append_sheet(wb,ws,'الطلاب');XLSX.writeFile(wb,'nafs-school-students-template.xlsx')}
async function makePdf(){
if(!students.length){setStatus('استورد ملف الطلاب أولاً');return}
if(!school){setStatus('اختر المدرسة قبل إصدار الملف');return}
if(!papers.current){setStatus('تعذر تحميل معاينة الأوراق');return}
setBusy(true);setStatus('جارٍ تجهيز أوراق الإجابة...');
try{
const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
await document.fonts.ready;
const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
const elements=Array.from(papers.current.querySelectorAll<HTMLElement>('.answer-paper'));
if(elements.length!==students.length)throw new Error('عدد أوراق الإجابة لا يطابق عدد الطلاب');
for(let i=0;i<elements.length;i++){
setStatus('جارٍ إصدار الصفحة '+(i+1)+' من '+elements.length);
await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const canvas=await html2canvas(elements[i],{
scale:1.5,backgroundColor:'#ffffff',useCORS:false,logging:false,
windowWidth:1100,windowHeight:1300,
onclone:(doc)=>{
const stage=doc.querySelector<HTMLElement>('.pdf-stage');
if(stage){stage.style.position='absolute';stage.style.left='0px';stage.style.top='0px';stage.style.zIndex='1';stage.style.pointerEvents='none'}
}
});
if(canvas.width<100||canvas.height<100)throw new Error('تعذر تصوير ورقة الطالب رقم '+(i+1));
if(i>0)pdf.addPage();
pdf.addImage(canvas.toDataURL('image/jpeg',0.9),'JPEG',0,0,210,297);
canvas.width=0;canvas.height=0;
}
pdf.save('nafs-answer-sheets.pdf');
setStatus('تم إصدار ملف PDF بنجاح: '+students.length+' ورقة إجابة');
}catch(e){setStatus('تعذر إصدار PDF: '+(e instanceof Error?e.message:'خطأ غير معروف'))}
finally{setBusy(false)}
}
const schoolName=schools.find(s=>s.id===school)?.name||'اسم المدرسة';
return <main className="sheet-app" dir="rtl"><div className="sheet-toolbar"><a href="/workspace">← العودة إلى لوحة النظام</a><h1>طباعة أوراق إجابات الطلاب</h1><p>استيراد ملف المدرسة كما هو: اسم الطالب في العمود B ورقم الطالب في العمود C، مع السماح بعنوان المدرسة أعلى الجدول.</p></div>{!user?<div className="sheet-panel">يرجى <a href="/">تسجيل الدخول</a> أولًا.</div>:<><section className="sheet-panel"><div className="sheet-fields"><label>المدرسة <select style={field} value={school} onChange={e=>setSchool(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{['لغتي','رياضيات','علوم'].map((s,i)=><label key={s}>عدد أسئلة {s} <input style={{...field,minWidth:75,width:80}} type="number" min="1" max="20" value={counts[i]} onChange={e=>setCounts(old=>old.map((v,j)=>i===j?Math.min(20,Math.max(1,Number(e.target.value)||1)):v))}/></label>)}</div><div className="sheet-fields"><button style={button} onClick={template}>تحميل قالب Excel</button><label className="file-label">استيراد أسماء الطلاب <input type="file" accept=".xlsx,.xls" onChange={e=>{const f=e.target.files?.[0];if(f)readStudents(f);e.target.value=''}}/></label><button style={button} type="button" disabled={busy||!students.length||!school} onClick={makePdf}>{busy?'جارٍ إنشاء الملف...':'إصدار PDF لجميع الطلاب'}</button></div><p role="status">{status}</p><p>عدد الطلاب المستوردين: <strong>{students.length}</strong> — صفحة واحدة لكل طالب، مقاس A4.</p></section>{students.length>0&&<section className="sheet-panel"><h2>معاينة ورقة الإجابة</h2><div className="sheet-fields"><button onClick={()=>setPreview(p=>Math.max(0,p-1))} disabled={!preview}>السابق</button><span>{preview+1} / {students.length}</span><button onClick={()=>setPreview(p=>Math.min(students.length-1,p+1))} disabled={preview===students.length-1}>التالي</button></div><div className="sheet-preview"><Paper student={students[preview]} schoolName={schoolName} counts={counts}/></div></section>}<div ref={papers} className="pdf-stage" aria-hidden="true">{students.map((s,i)=><Paper key={s.code+'-'+i} student={s} schoolName={schoolName} counts={counts}/>)}</div></>}</main>
}
