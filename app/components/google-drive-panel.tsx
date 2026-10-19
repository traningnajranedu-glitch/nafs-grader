'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
type Status={connected:boolean;folderAccess?:boolean;error?:string|null};
export default function GoogleDrivePanel(){
 const [folderUrl,setFolderUrl]=useState('');const [queue,setQueue]=useState<{file_id:string;file_name:string;state:string}[]>([]);const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function token(){const {data,error}=await supabase!.auth.getSession();if(error||!data.session?.access_token)throw Error('يرجى تسجيل الدخول مرة أخرى');return data.session.access_token}
 async function check(){setBusy(true);try{const res=await fetch('/api/google/status',{headers:{Authorization:'Bearer '+await token()},cache:'no-store'});const body=await res.json();setStatus(body);setMessage(body.error||'')}catch(e){setMessage(e instanceof Error?e.message:'تعذر فحص الاتصال')}finally{setBusy(false)}}
 async function createFolder(){setBusy(true);setMessage('');try{const res=await fetch('/api/google/folder',{method:'POST',headers:{Authorization:'Bearer '+await token()}});const body=await res.json();if(!res.ok)throw Error(body.error||'تعذر إنشاء المجلد');setMessage('تم إنشاء المجلد. افتحه من الرابط ثم حدّث إعداد مجلد الإدخال في Vercel بالمعرّف: '+body.folderId);setFolderUrl(body.url)}catch(e){setMessage(e instanceof Error?e.message:'تعذر إنشاء المجلد')}finally{setBusy(false)}}
 async function scan(){setBusy(true);setMessage('');try{const res=await fetch('/api/google/scan',{method:'POST',headers:{Authorization:'Bearer '+await token()}});const body=await res.json();if(!res.ok)throw Error(body.error||'تعذر فحص ملفات PDF');setQueue(body.queue||[]);setMessage('تم اكتشاف '+body.found+' ملف PDF؛ أضيف '+body.inserted+' ملف جديد لقائمة الانتظار. التصحيح لم يبدأ بعد.')}catch(e){setMessage(e instanceof Error?e.message:'تعذر فحص الملفات')}finally{setBusy(false)}}
 async function connect(){setBusy(true);setMessage('');try{const res=await fetch('/api/google/connect',{method:'POST',headers:{Authorization:'Bearer '+await token()}});const data=await res.json();if(!res.ok||!data.url)throw Error(data.error||'تعذر بدء الاتصال');window.location.assign(data.url)}catch(e){setMessage(e instanceof Error?e.message:'تعذر بدء الاتصال');setBusy(false)}}
 useEffect(()=>{void check();const state=new URLSearchParams(window.location.search).get('drive');if(state==='failed')setMessage('تعذر إكمال تفويض Google. تأكد من تطبيق ترحيل قاعدة البيانات وصلاحيات المجلد.');if(state==='connected')setMessage('تم تسجيل تفويض Google؛ افحص صلاحيات مجلد الإدخال.')},[]);
 return <section style={{background:'#fff',border:'1px solid #dbe6eb',borderRadius:16,padding:20,marginBottom:16}}>
  <h3>ربط Google Drive</h3><p>المرحلة الأولى: تفويض حساب Google وفحص إمكانية الوصول إلى مجلد ملفات المدارس.</p>
  <p><strong>حالة التفويض:</strong> {status?.connected?'متصل':status?'غير متصل':'جارٍ الفحص...'}</p>
  {status?.connected&&<p><strong>مجلد PDF:</strong> {status.folderAccess?'متاح':'لم يتم منح التطبيق حق الوصول إلى المجلد بعد'}</p>}
  <button type="button" disabled={busy||!status?.connected} onClick={()=>void createFolder()} style={{background:'#14532d',color:'#fff',border:0,borderRadius:10,padding:'11px 18px',margin:5,cursor:'pointer'}}>إنشاء مجلد الاستقبال وربطه</button>
  {folderUrl&&<a href={folderUrl} target="_blank" rel="noreferrer">فتح مجلد الاستقبال الجديد</a>}
  <button type="button" disabled={busy} onClick={()=>void connect()} style={{background:'#087e83',color:'#fff',border:0,borderRadius:10,padding:'11px 18px',margin:5,cursor:'pointer'}}>ربط حساب Google Drive</button>
  <button type="button" disabled={busy} onClick={()=>void check()} style={{border:'1px solid #087e83',borderRadius:10,padding:'11px 18px',margin:5,cursor:'pointer'}}>فحص الاتصال</button>
  <button type="button" disabled={busy||!status?.connected} onClick={()=>void scan()} style={{background:'#1d4ed8',color:'#fff',border:0,borderRadius:10,padding:'11px 18px',margin:5,cursor:'pointer'}}>فحص ملفات PDF وإضافتها لقائمة الانتظار</button>
  {queue.length>0&&<div style={{marginTop:12}}><strong>قائمة الملفات ({queue.length})</strong><ul>{queue.map(item=><li key={item.file_id}>{item.file_name} — {item.state==='pending'?'بانتظار المعالجة':item.state}</li>)}</ul></div>}
  {message&&<p role="status" style={{color:'#9a3412'}}>{message}</p>}
  <p style={{fontSize:12,color:'#64748b'}}>فحص الملفات يسجلها دون تصحيح أو اعتماد النتائج. صلاحية drive.file تتطلب منح التطبيق وصولًا صريحًا إلى المجلدات.</p>
 </section>
}