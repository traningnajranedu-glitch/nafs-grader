'use client';
import {useEffect,useRef,useState} from 'react';
import * as XLSX from 'xlsx';
import {supabase} from '../../lib/supabase';
import {readStudentRoster} from '../../lib/student-roster';
import {Paper} from '../components/answer-paper';
import SchoolSupport from '../components/school-support';
type Student={code:string;name:string;grade:string;section:string};
const field={padding:'11px 12px',border:'1px solid #cbd5e1',borderRadius:9,minWidth:180,maxWidth:'100%'} as const;
const button={background:'#087e83',color:'#fff',border:0,borderRadius:9,padding:'12px 20px',cursor:'pointer'} as const;
const choices=['د','ج','ب','أ'];
export default function Sheets(){
const [schoolNameInput,setSchoolNameInput]=useState(''),[schoolOptions,setSchoolOptions]=useState<{id:string;name:string;gender:string|null;stage:string|null}[]>([]),[gender,setGender]=useState(''),[stage,setStage]=useState(''),[grade,setGrade]=useState('');
const [students,setStudents]=useState<Student[]>([]),[counts,setCounts]=useState([20,20,20]),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(0);
const papers=useRef<HTMLDivElement>(null);
useEffect(()=>{if(!supabase)return;supabase.from('schools').select('id,name,gender,stage').order('name').then(r=>{if(r.error)setStatus('تعذر تحميل قائمة المدارس: '+r.error.message);else setSchoolOptions(r.data||[])})},[]);
async function registerRoster(list:Student[]){const school=schoolOptions.find(s=>s.name===schoolNameInput&&s.gender===gender&&s.stage===stage);if(!school)throw Error('اختر الجنس والمرحلة واسم المدرسة قبل استيراد الطلاب');if(!supabase)throw Error('الاتصال غير متاح');const r=await supabase.functions.invoke('school-roster',{body:{school:school.id,grade,students:list.map(s=>({student_code:s.code,full_name:s.name}))}});if(r.error){let detail='تعذر حفظ بيانات الطلاب؛ أعد المحاولة';try{const body=await r.error.context?.json();if(typeof body?.error==='string')detail=body.error}catch{}throw Error(detail)}if(r.data?.error)throw Error(r.data.error);return r.data.registered}
function readStudents(file:File){if(!schoolOptions.some(s=>s.name===schoolNameInput&&s.gender===gender&&s.stage===stage)){setStatus('اختر الجنس والمرحلة واسم المدرسة قبل استيراد الطلاب');return}setBusy(true);setStatus('جارٍ قراءة ملف الطلاب وحفظ البيانات...');setStudents([]);readStudentRoster(file).then(async roster=>{if(roster.length>250)throw Error('الحد الأقصى للدفعة الواحدة 250 طالبًا');const parsed:Student[]=roster.map(s=>({name:s.full_name,code:s.student_code,grade:s.grade||'',section:''}));await registerRoster(parsed);setStudents(parsed);setPreview(0);setStatus('تم حفظ بيانات '+parsed.length+' طالبًا وتجهيز دخولهم للإجابة الإلكترونية. إصدار PDF اختياري')}).catch(e=>setStatus(e instanceof Error?e.message:'تعذر قراءة ملف Excel')).finally(()=>setBusy(false))}
function template(){const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([['','مدرسة: اسم المدرسة',''],['','اسم الطالب','رقم الطالب'],['','طالب تجريبي','1000000001']]);ws['C3'].t='s';ws['!cols']=[{wch:4},{wch:38},{wch:20}];XLSX.utils.book_append_sheet(wb,ws,'الطلاب');XLSX.writeFile(wb,'nafs-school-students-template.xlsx')}
async function makePdf(){
if(!students.length){setStatus('استورد ملف الطلاب أولاً');return}
if(!schoolNameInput.trim()||!gender||!stage||!schoolOptions.some(s=>s.name===schoolNameInput&&s.gender===gender&&s.stage===stage)){setStatus('اختر الجنس والمرحلة ثم مدرسة مطابقة من القائمة قبل إصدار الملف');return}
if(!papers.current){setStatus('تعذر تحميل معاينة الأوراق');return}
setBusy(true);setStatus('جارٍ تجهيز أوراق الإجابة...');
try{
await registerRoster(students);
const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
await document.fonts.ready;
for(let tries=0;tries<100&&papers.current.querySelector('[data-qr-ready="false"]');tries++)await new Promise(r=>setTimeout(r,100));
if(papers.current.querySelector('[data-qr-ready="false"]'))throw Error('لم يكتمل تجهيز رموز بيانات الأوراق؛ أعد المحاولة');
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
if(!supabase)throw new Error('تعذر تسجيل عملية الإصدار: الاتصال بقاعدة البيانات غير متاح');
const log=await supabase.from('answer_sheet_prints').insert({school_name:schoolNameInput.trim(),gender,stage,grade:grade||null,student_count:students.length});
if(log.error)throw new Error('تم إنشاء PDF ولكن تعذر تسجيل العملية لدى مدير النظام: '+log.error.message);
setStatus('تم إصدار ملف PDF وتسجيل العملية لدى مدير النظام: '+students.length+' ورقة إجابة');
}catch(e){setStatus('تعذر إصدار PDF: '+(e instanceof Error?e.message:'خطأ غير معروف'))}
finally{setBusy(false)}
}
const schoolName=schoolNameInput.trim();
return <main className="sheet-app" dir="rtl"><div className="sheet-toolbar"><a href="/">← الصفحة الرئيسية</a><h1>طباعة أوراق إجابات الطلاب</h1><SchoolSupport key={schoolOptions.find(s=>s.name===schoolNameInput&&s.gender===gender&&s.stage===stage)?.id||"no-school"} school={schoolOptions.find(s=>s.name===schoolNameInput&&s.gender===gender&&s.stage===stage)}/><p>اختر اسم المدرسة من القائمة ثم استورد ملف Excel الذي يحتوي على اسم الطالب ورقم الطالب لحفظ بيانات الطلاب وتجهيز ورقة الإجابة الإلكترونية، مع إمكانية إصدار PDF.</p></div><section className="sheet-panel"><div className="sheet-fields">
<label>اسم المدرسة <select style={field} required disabled={busy} value={schoolNameInput} onChange={e=>{setSchoolNameInput(e.target.value);setStudents([])}}><option value="">اختر المدرسة</option>{schoolOptions.filter(s=>s.gender===gender&&s.stage===stage).map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></label>
<label>الجنس <select style={field} required disabled={busy} value={gender} onChange={e=>{setGender(e.target.value);setSchoolNameInput('');setStudents([])}}><option value="">اختر الجنس</option><option value="بنين">بنين</option><option value="بنات">بنات</option></select></label>
<label>المرحلة <select style={field} required disabled={busy} value={stage} onChange={e=>{setStage(e.target.value);setSchoolNameInput('');setStudents([])}}><option value="">اختر المرحلة</option>{['طفولة مبكرة','ابتدائي','متوسط','ثانوي'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
<label>الصف (اختياري) <select style={field} disabled={busy} value={grade} onChange={e=>setGrade(e.target.value)}><option value="">اختر الصف</option>{Array.from({length:10},(_,i)=>i+1).map(n=><option key={n} value={String(n)}>{n}</option>)}</select></label></div><div className="sheet-fields"><button style={button} onClick={template}>تحميل قالب Excel</button><label className="file-label">استيراد أسماء الطلاب <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)readStudents(f);e.target.value=''}}/></label><button style={button} type="button" disabled={busy||!students.length||!schoolNameInput.trim()||!gender||!stage} onClick={makePdf}>{busy?'جارٍ إنشاء الملف...':'إصدار PDF لجميع الطلاب'}</button></div><p role="status">{status}</p><p>للمدارس التي أصدرت نماذج سابقًا: أعد رفع ملف الأسماء مرة واحدة لحفظ بيانات الطلاب. لا يلزم إصدار PDF جديد.</p><a href="/student">صفحة الإجابة الإلكترونية للطلاب</a><p>عدد الطلاب المستوردين: <strong>{students.length}</strong> — صفحة واحدة لكل طالب، مقاس A4.</p></section>{students.length>0&&<section className="sheet-panel"><h2>معاينة ورقة الإجابة</h2><div className="sheet-fields"><button onClick={()=>setPreview(p=>Math.max(0,p-1))} disabled={!preview}>السابق</button><span>{preview+1} / {students.length}</span><button onClick={()=>setPreview(p=>Math.min(students.length-1,p+1))} disabled={preview===students.length-1}>التالي</button></div><div className="sheet-preview"><Paper student={students[preview]} schoolName={schoolName} gender={gender} stage={stage} grade={grade} counts={counts}/></div></section>}<div ref={papers} className="pdf-stage" aria-hidden="true">{students.map((s,i)=><Paper key={s.code+'-'+i} student={s} schoolName={schoolName} gender={gender} stage={stage} grade={grade} counts={counts}/>)}</div></main>
}

