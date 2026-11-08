'use client';
import {useState} from 'react';
import {supabase} from '../../../lib/supabase';
export default function UnifiedExcelExport(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){
  setBusy(true);setError('');
  try{
   if(!supabase)throw new Error('اتصال قاعدة البيانات غير متاح');
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error('سجّل الدخول بحساب مدير النظام');
   const res=await fetch('/api/results/individual/export-all',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
   if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.error||'تعذر إنشاء ملف Excel');}
   const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='نتائج نافس 2026 - المصنف الشامل.xlsx';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 return <section dir="rtl" style={{margin:'0 0 18px',padding:18,border:'1px solid #2c8ba4',borderRadius:18,background:'linear-gradient(110deg,#07314d,#07556a)',color:'#fff'}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,flexWrap:'wrap'}}>
   <div><strong style={{fontSize:18}}>المصنف الشامل لنتائج نافس 2026</strong><p style={{margin:'6px 0 0',color:'#cce8ef',fontSize:13}}>جميع المدارس والمراحل الثلاث · الطلاب والمواد والإجابات والمهارات</p></div>
   <button onClick={download} disabled={busy} style={{border:0,borderRadius:12,padding:'12px 18px',fontWeight:800,cursor:busy?'wait':'pointer',background:'#f5d48a',color:'#173b50'}}>{busy?'جارٍ تجهيز المصنف…':'تنزيل Excel الشامل ↓'}</button>
  </div>
  {error&&<p role="alert" style={{margin:'10px 0 0',color:'#ffd0c8'}}>{error}</p>}
 </section>;
}
