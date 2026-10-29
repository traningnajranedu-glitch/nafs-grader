'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

export default function SchoolResultsDownload(){
 const [username,setUsername]=useState('');
 const [error,setError]=useState('');
 const router=useRouter();
 function proceed(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(username.trim()!=='adminnafs'){setError('اسم المستخدم غير صحيح');return;}
  setError('');
  // The username is a navigation hint only, not an authentication credential.
  // /results retains its existing Supabase admin authorization checks.
  router.push('/results');
 }
 return <main dir="rtl" style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'linear-gradient(140deg,#071b36,#10486b)',padding:20,fontFamily:'system-ui,sans-serif'}}>
  <section style={{width:'100%',maxWidth:440,background:'white',padding:32,borderRadius:22,boxShadow:'0 20px 60px #001a3555'}}>
   <div style={{color:'#a98235',fontWeight:800,marginBottom:12}}>نافس 2026</div>
   <h1 style={{color:'#092b47',fontSize:25,margin:'0 0 12px'}}>بوابة تنزيل نتائج المدارس</h1>
   <p style={{color:'#536577',lineHeight:1.8}}>أدخل اسم المستخدم للانتقال إلى مركز النتائج، ثم اختر المرحلة والجنس والمدرسة.</p>
   <form onSubmit={proceed}>
    <label htmlFor="username" style={{display:'block',marginBottom:9,fontWeight:700}}>اسم المستخدم</label>
    <input id="username" autoComplete="username" value={username} onChange={e=>{setUsername(e.target.value);setError('')}} placeholder="أدخل اسم المستخدم" required style={{width:'100%',boxSizing:'border-box',border:'1px solid #c8d7e4',padding:14,borderRadius:12,fontSize:16}}/>
    {error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}
    <button type="submit" style={{marginTop:16,width:'100%',padding:14,border:0,borderRadius:12,background:'#0a507a',color:'white',fontWeight:700,fontSize:16,cursor:'pointer'}}>الدخول إلى مركز النتائج</button>
   </form>
   <p style={{fontSize:12,color:'#667788',lineHeight:1.8,marginTop:20}}>حماية ملفات الطلاب مستقلة عن هذا النموذج. يتطلب عرض البيانات وتنزيل الملفات الأصلية صلاحية معتمدة في النظام.</p>
  </section>
 </main>;
}
