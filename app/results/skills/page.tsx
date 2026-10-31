'use client';
import {useMemo,useState} from 'react';
type Skill={id:string;name:string;questions:number[];treatment:string};
type Result={student:string;correct:number[];verified:boolean;post?:number[]};
const threshold=75;
const initial:Skill={id:'math-m3-01',name:'حل المسائل الحسابية والمعادلات الرياضية',questions:[11,12,13,14],treatment:'تدريبات علاجية فردية ومجموعات تعلم'};
export default function SkillsPage(){
 const [skill,setSkill]=useState<Skill>(initial);
 const [draft,setDraft]=useState(initial);
 const [results,setResults]=useState<Result[]>([]);
 const [student,setStudent]=useState('');
 const [answers,setAnswers]=useState('');
 const [verified,setVerified]=useState(false);
 const [tab,setTab]=useState<'skills'|'treatment'|'report'>('skills');
 const [approved,setApproved]=useState(false);
 const eligible=results.filter(r=>r.verified&&r.correct.length===skill.questions.length);
 const mastery=(r:Result,post=false)=>{const a=post?r.post:r.correct;return a&&a.length===skill.questions.length?a.reduce((n,x)=>n+x,0)/a.length*100:null};
 const mastered=eligible.filter(r=>(mastery(r)??0)>=threshold).length;
 const rate=eligible.length?Math.round(mastered/eligible.length*100):null;
 const needs=eligible.filter(r=>(mastery(r)??0)<threshold);
 const post=eligible.filter(r=>mastery(r,true)!==null);
 const postRate=post.length?Math.round(post.filter(r=>(mastery(r,true)??0)>=threshold).length/post.length*100):null;
 function add(){const values=answers.split(/[،,\s]+/).filter(Boolean).map(Number);if(!student.trim()||values.length!==skill.questions.length||values.some(x=>x!==0&&x!==1))return alert('أدخل الاسم و4 إجابات 0 أو 1');setResults(v=>[...v,{student:student.trim(),correct:values,verified}]);setStudent('');setAnswers('');setVerified(false)}
 const card:React.CSSProperties={background:'#fff',borderRadius:16,padding:20,boxShadow:'0 6px 20px #0b39551a',marginBottom:14};
 const input:React.CSSProperties={width:'100%',padding:12,border:'1px solid #a5bdc8',borderRadius:10,margin:'6px 0 12px',font:'inherit'};
 const btn:React.CSSProperties={padding:'11px 18px',border:0,borderRadius:10,background:'#087c87',color:'#fff',fontWeight:700,cursor:'pointer',margin:4};
 return <main dir="rtl" style={{minHeight:'100vh',background:'#eef5f8',color:'#12384a',fontFamily:'system-ui,sans-serif',padding:'24px max(18px,calc((100vw - 1100px)/2))'}}>
 <header style={{...card,background:'#073b58',color:'white'}}><h1>مهارات نافس وخطط المعالجة</h1><p>ثالث متوسط — رياضيات | معيار الإتقان 75%</p><small>نسخة تجريبية مستقلة — لا تتصل ببيانات الطلاب الحقيقية ولا تعتمد النتائج</small></header>
 <nav style={card}>{(['skills','treatment','report'] as const).map((t,i)=><button key={t} style={{...btn,background:tab===t?'#073b58':'#087c87'}} onClick={()=>setTab(t)}>{['إدخال المهارات والنتائج','خطة المعالجة والاختبار البعدي','التقرير'][i]}</button>)}</nav>
 {tab==='skills'&&<><section style={card}><h2>ربط المهارة بالأسئلة</h2><label>اسم المهارة<input style={input} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>أرقام الأسئلة مفصولة بفواصل<input style={input} value={draft.questions.join('، ')} onChange={e=>setDraft({...draft,questions:e.target.value.split(/[،,\s]+/).map(Number).filter(x=>Number.isInteger(x)&&x>0)})}/></label><label>المعالجة المقترحة<textarea style={input} value={draft.treatment} onChange={e=>setDraft({...draft,treatment:e.target.value})}/></label><button style={btn} onClick={()=>{if(!draft.questions.length)return;setSkill(draft);setResults([]);setApproved(false)}}>حفظ المهارة (محليًا)</button></section>
 <section style={card}><h2>إدخال بيانات تجريبية للاختبار فقط</h2><p>لا تدخل أسماء طلاب حقيقية هنا. الربط الفعلي يتطلب صلاحيات وقاعدة بيانات مؤمنة.</p><input style={input} placeholder="رمز طالب افتراضي" value={student} onChange={e=>setStudent(e.target.value)}/><input style={input} placeholder="إجابات 0 و1، مثال: 1,1,0,1" value={answers} onChange={e=>setAnswers(e.target.value)}/><label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> نتيجة متحقق منها</label><div><button style={btn} onClick={add}>إضافة نتيجة تجريبية</button></div></section></>}
 {tab==='treatment'&&<section style={card}><h2>خطة المعالجة</h2><p>{skill.treatment}</p><p>الطلاب المحتاجون للمعالجة: {needs.length}</p>{needs.map((r,i)=><div key={i} style={{borderTop:'1px solid #d4e4e9',padding:12}}><strong>{r.student}</strong> — قبلي {mastery(r)}%<label style={{display:'block'}}>الاختبار البعدي (0/1 لكل سؤال)<input style={input} placeholder="1,1,1,0" value={r.post?.join(',')??''} onChange={e=>{const a=e.target.value.split(/[،,\s]+/).filter(Boolean).map(Number);setResults(old=>old.map(x=>x===r?{...x,post:a.every(v=>v===0||v===1)?a:undefined}:x))}}/></label><span>بعدي: {mastery(r,true)===null?'غير مكتمل':mastery(r,true)+'%'}</span></div>)}</section>}
 {tab==='report'&&<section style={card}><h2>تقرير المهارات التي تحتاج معالجة</h2><p>المهارة: {skill.name} | الأسئلة: {skill.questions.join('، ')}</p><p>نتائج مؤهلة للاحتساب: {eligible.length} | غير محسومة: {results.length-eligible.length}</p><p>إتقان المدرسة: {rate===null?'لا توجد بيانات معتمدة':rate+'%'} | {rate!==null&&(rate<75?'تحتاج معالجة':'متقنة')}</p><p>الاختبار البعدي: {postRate===null?'لا توجد نتائج بعدية مكتملة':postRate+'%'} (عدد {post.length})</p><p>المعالجة: {skill.treatment}</p><button style={btn} disabled={!eligible.length||approved} onClick={()=>setApproved(true)}>{approved?'تم اعتماد المعاينة محليًا':'اعتماد المعاينة فقط'}</button><button style={btn} onClick={()=>window.print()}>طباعة التقرير</button><p style={{fontSize:12,color:'#9a4b20'}}>الاعتماد هنا تجريبي محلي، ولا يغيّر قاعدة البيانات أو مؤشرات نافس المنشورة.</p></section>}
 </main>
}