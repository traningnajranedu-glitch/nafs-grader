'use client';

import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';

type AccessState='checking'|'signed_out'|'denied'|'admin'|'unavailable';

export default function PublishingCenter(){
  const [access,setAccess]=useState<AccessState>('checking');
  const [email,setEmail]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    async function verify(){
      if(!supabase){if(active)setAccess('unavailable');return;}
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(!active)return;
      if(authError||!user){setAccess('signed_out');return;}
      setEmail(user.email||'');
      const {data,error:roleError}=await supabase.from('system_admins')
        .select('user_id').eq('user_id',user.id).limit(1);
      if(!active)return;
      if(roleError){setError('تعذر التحقق من صلاحية الحساب.');setAccess('unavailable');return;}
      setAccess(data?.length?'admin':'denied');
    }
    void verify();
    const {data}=supabase?.auth.onAuthStateChange(()=>{void verify();})||{data:{subscription:{unsubscribe(){}}}};
    return ()=>{active=false;data.subscription.unsubscribe();};
  },[]);

  const shell:React.CSSProperties={minHeight:'100vh',background:'linear-gradient(145deg,#071e35,#0b3b55 55%,#0c5961)',padding:'32px 18px',color:'#eff8fb'};
  const card:React.CSSProperties={background:'#ffffff',color:'#16384a',border:'1px solid #dce8ed',borderRadius:20,padding:22,boxShadow:'0 12px 34px #00172b35'};
  const button:React.CSSProperties={display:'inline-block',padding:'12px 18px',borderRadius:11,background:'#0c6971',color:'#fff',textDecoration:'none',fontWeight:700};
  const status=(label:string,color:string)=> <span style={{display:'inline-block',padding:'6px 11px',borderRadius:30,background:color,fontSize:12,fontWeight:700}}>{label}</span>;

  return <main dir="rtl" style={shell}>
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      <header style={{textAlign:'center',padding:'22px 10px 30px'}}>
        <div style={{fontSize:13,color:'#c6e1e9'}}>الإدارة العامة للتعليم بنجران · إدارة أداء التعليم</div>
        <div style={{fontSize:44,margin:'16px 0 6px'}}>▦</div>
        <h1 style={{fontSize:'clamp(25px,4vw,38px)',margin:'0 0 10px',color:'#f5d99c'}}>مركز نشر النتائج والخدمات الرقمية</h1>
        <div style={{fontSize:20,fontWeight:700}}>نافس 2026</div>
        <p style={{color:'#c6e1e9',lineHeight:1.9,maxWidth:700,margin:'12px auto'}}>بوابة مستقلة لإتاحة النتائج المعتمدة، ومتابعة المؤشرات والتقارير والخدمات الرقمية وفق صلاحيات المستخدم.</p>
      </header>

      {access==='checking'&&<section style={card}><h2>جارٍ التحقق من صلاحية الدخول</h2><p>يتم التحقق من جلسة الحساب وصلاحية مدير النظام.</p></section>}
      {access==='signed_out'&&<section style={card}><h2>تسجيل الدخول مطلوب</h2><p>امسح رمز QR للوصول إلى هذه البوابة، ثم سجّل الدخول بالحساب المعتمد في النظام.</p><a href="/" style={button}>الانتقال إلى تسجيل الدخول</a></section>}
      {access==='denied'&&<section style={card}><h2>لا توجد صلاحية لهذا الحساب</h2><p>الحساب المسجل ({email}) لا يملك حاليًا صلاحية مدير النظام. لا يتم عرض أي نتائج أو بيانات طلاب.</p><a href="/" style={button}>العودة</a></section>}
      {access==='unavailable'&&<section style={card}><h2>تعذر التحقق من الصلاحية</h2><p>{error||'تعذر الاتصال بخدمة المصادقة. يرجى المحاولة لاحقًا.'}</p><a href="/" style={button}>العودة لتسجيل الدخول</a></section>}

      {access==='admin'&&<>
        <section style={{...card,marginBottom:18}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}>
            <div><div style={{fontSize:13,color:'#607987'}}>حساب مدير النظام</div><strong>{email}</strong></div>
            {status('بوابة داخلية محمية','#e1f4ec')}
          </div>
          <h2 style={{margin:'22px 0 8px'}}>مركز التحكم بالنشر</h2>
          <p style={{lineHeight:1.9,color:'#526b78',margin:0}}>هذه هي المرحلة الأولى من المركز. لم تُنشر أي نتائج من خلال هذه الوحدة بعد، ولا تُعرض السجلات المعلقة أو الأولية على أنها نتائج نهائية.</p>
        </section>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
          <article style={card}><div style={{fontSize:28}}>①</div><h3>التحقق من النتائج</h3><p style={{color:'#607987',lineHeight:1.8}}>يجب أن تكون سجلات النتائج مكتملة واجتازت فحوص الجودة ومطابقة نموذج الإجابة.</p>{status('شرط سابق للنشر','#fff1d8')}</article>
          <article style={card}><div style={{fontSize:28}}>②</div><h3>اعتماد الإصدار</h3><p style={{color:'#607987',lineHeight:1.8}}>اعتماد مستقل موثق قبل إتاحة أي إصدار، مع تحديد المرحلة والمدرسة ونطاق البيانات.</p>{status('بانتظار ربط سير الاعتماد','#edf0f4')}</article>
          <article style={card}><div style={{fontSize:28}}>③</div><h3>إتاحة النتائج</h3><p style={{color:'#607987',lineHeight:1.8}}>تظهر النتائج المنشورة فقط للمستخدمين المخولين، مع سجل عمليات وتاريخ إصدار.</p>{status('النشر غير مفعل بعد','#fde9e7')}</article>
        </div>
        <section style={{...card,marginTop:18}}>
          <h2>الخدمات المخطط ربطها</h2>
          <ul style={{lineHeight:2.1,color:'#526b78'}}>
            <li>لوحة مؤشرات مجمعة حسب المرحلة والمادة والجنس.</li>
            <li>تقارير المدارس بصيغ PDF وExcel وفق الصلاحيات.</li>
            <li>تحليل المهارات والفجوات وخطط التحسين.</li>
            <li>إدارة إصدارات النتائج وسجل تدقيق للنشر والتصدير.</li>
          </ul>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <a href="/workspace" style={button}>العودة إلى إدارة الاختبارات</a>
            <a href="/results" style={{...button,background:'#183f5a'}}>لوحة النتائج الحالية</a>
          </div>
        </section>
      </>}
      <footer style={{textAlign:'center',color:'#b9d4dd',fontSize:12,padding:'25px 0'}}>نافس 2026 · الوصول وفق الصلاحيات · لا يُعد QR وسيلة تحقق من الهوية</footer>
    </div>
  </main>;
}
