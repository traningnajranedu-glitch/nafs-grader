'use client';
import {useState} from 'react';
import {supabase} from '../../../lib/supabase';
type FileItem={id:string;name:string;url:string};
type Stage={stage:string;files:FileItem[]};
const labels:Record<string,string>={primary3:'ثالث ابتدائي',primary6:'سادس ابتدائي',middle3:'ثالث متوسط'};
const normalize=(s:string)=>s.trim().replace(/\s+/g,' ').replace(/[أإآ]/g,'ا');
const genderOf=(name:string)=>/بنات|بنت|اناث|إناث/.test(normalize(name))?'girls':/بنين|ذكور/.test(normalize(name))?'boys':'unknown';
const schoolOf=(name:string)=>name.replace(/\.xlsx?$/i,'').replace(/[-_ ]*(نتائج|نتيجة|درجات|طلاب|الطلاب)[-_ ]*/g,' ').trim();
export default function DownloadResults(){
 const [username,setUsername]=useState(''),[entered,setEntered]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [stages,setStages]=useState<Stage[]>([]),[stage,setStage]=useState(''),[gender,setGender]=useState(''),[school,setSchool]=useState(''),[busy,setBusy]=useState(false);
 async function enter(e:React.FormEvent){e.preventDefault();if(username.trim()!=='adminnafs'){setError('اسم المستخدم غير صحيح');return;}setError('');setEntered(true);await load();}
 async function sessionToken(){if(!supabase)throw Error('اتصال قاعدة البيانات غير متاح');const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('يلزم تسجيل الدخول بحساب مصرح له لتنزيل ملفات الطلاب');return session.access_token;}
 async function load(){setLoading(true);setError('');try{const token=await sessionToken();const response=await fetch('/api/results/drive',{headers:{Authorization:'Bearer '+token},cache:'no-store'});const body=await response.json();if(!response.ok)throw Error(body.error||'تعذر قراءة ملفات النتائج');setStages(body.stages||[])}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setLoading(false)}}
 async function downloadCatalog(){setBusy(true);setError('');try{const token=await sessionToken();const response=await fetch('/api/results/download/catalog',{headers:{Authorization:'Bearer '+token}});if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error||'تعذر تنزيل الفهرس')}const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nafs-483-school-results.xlsx';a.click();URL.revokeObjectURL(url)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const files=stages.filter(s=>!stage||s.stage===stage).flatMap(s=>s.files.map(f=>({...f,stage:s.stage,school:schoolOf(f.name)}))).filter(f=>!gender||genderOf(f.school)===gender);
 const schools=[...new Set(files.map(f=>f.school))].sort((a,b)=>a.localeCompare(b,'ar'));
 const selected=files.filter(f=>f.school===school);
 async function download(fileId:string){setBusy(true);setError('');try{const token=await sessionToken();const response=await fetch('/api/results/download/file?fileId='+encodeURIComponent(fileId),{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error||'تعذر تنزيل الملف')}const blob=await response.blob();const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=selected.find(f=>f.id===fileId)?.name||'results.xlsx';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(href)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const field:React.CSSProperties={width:'100%',padding:13,border:'1px solid #cbd5e1',borderRadius:10,background:'white',fontSize:16};
 return <main dir="rtl" style={{minHeight:'100vh',background:'#edf5f7',padding:'40px 16px',fontFamily:'system-ui,sans-serif',color:'#12364b'}}><section style={{maxWidth:640,margin:'auto',background:'white',borderRadius:20,padding:28,boxShadow:'0 12px 40px #07304416'}}>
 <div style={{color:'#a37a2a',fontWeight:800}}>نافس 2026</div><h1>بوابة تنزيل نتائج المدارس</h1>
 {!entered?<form onSubmit={enter}><p>أدخل اسم المستخدم للانتقال إلى صفحة اختيار المدرسة.</p><label htmlFor="username">اسم المستخدم</label><input id="username" value={username} onChange={e=>setUsername(e.target.value)} style={field} required/><button style={{...field,marginTop:15,background:'#0b617b',color:'white',cursor:'pointer'}}>دخول</button></form>:<div><p>اختر المرحلة والجنس والمدرسة لتنزيل ملف Excel الأصلي من Google Drive.</p><button disabled={busy} onClick={()=>void downloadCatalog()} style={{width:'100%',padding:13,border:0,borderRadius:10,background:'#a37a2a',color:'white',fontSize:16,marginBottom:18,cursor:'pointer'}}>تنزيل فهرس ملفات نتائج 483 مدرسة Excel</button>
 <label>المرحلة</label><select style={field} value={stage} onChange={e=>{setStage(e.target.value);setSchool('')}}><option value="">اختر المرحلة</option>{Object.entries(labels).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
 <label>الجنس</label><select style={field} value={gender} onChange={e=>{setGender(e.target.value);setSchool('')}}><option value="">الكل</option><option value="boys">بنين</option><option value="girls">بنات</option></select>
 <label>المدرسة</label><select style={field} value={school} onChange={e=>setSchool(e.target.value)} disabled={!stage}><option value="">اختر المدرسة</option>{schools.map(name=><option key={name} value={name}>{name}</option>)}</select>
 {selected.map(f=><div key={f.id} style={{marginTop:16,padding:15,background:'#f0f7fa',borderRadius:10}}><div>{f.name}</div><button disabled={busy} onClick={()=>download(f.id)} style={{...field,background:'#0b617b',color:'white',marginTop:10,cursor:'pointer'}}>{busy?'جارٍ التنزيل...':'تنزيل Excel الأصلي'}</button></div>)}
 <button onClick={()=>void load()} disabled={loading} style={{...field,marginTop:20,cursor:'pointer'}}>{loading?'جارٍ تحميل الملفات...':'تحديث قائمة المدارس'}</button></div>}
 {error&&<p role="alert" style={{color:'#b42318',lineHeight:1.8}}>{error}</p>}
 <p style={{fontSize:13,color:'#667788',lineHeight:1.8}}>اسم المستخدم يفتح واجهة الاختيار فقط. الوصول إلى ملفات الطلاب يتطلب جلسة مدير نظام معتمدة؛ لا يتم نشر روابط الملفات الخاصة للعامة.</p></section></main>;
}
