'use client';

import {useCallback,useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';

type Role='publisher_admin'|'department_viewer'|'school_viewer';
type AccessState='checking'|'signed_out'|'denied'|'admin'|'viewer'|'unavailable';
type ImportRow={id:string;stage:string;school_name:string;imported_at:string;status:string};
type Release={id:string;import_id:string;stage:string;school_name:string;gender:string|null;status:string;verified_rows:number;excluded_rows:number;created_by:string;submitted_by:string|null;approved_by:string|null;published_by:string|null;created_at:string;published_at:string|null};
type AccessRow={user_id:string;role:Role;school_name:string|null;active:boolean};

const stageNames:Record<string,string>={primary3:'ثالث ابتدائي',middle3:'ثالث متوسط',primary6:'سادس ابتدائي'};
const statusNames:Record<string,string>={draft:'مسودة',submitted:'بانتظار الاعتماد',approved:'معتمد للنشر',published:'منشور',withdrawn:'مسحوب'};
const eligible=(r:any)=>r.status==='verified'&&!!r.student_name?.trim()&&r.score!==null&&r.total!==null&&r.answers!==null&&JSON.stringify(r.answers)!=='{}'&&JSON.stringify(r.answers)!=='[]';

export default function PublishingCenter(){
  const [access,setAccess]=useState<AccessState>('checking');
  const [isSystemAdmin,setIsSystemAdmin]=useState(false);
  const [userId,setUserId]=useState('');
  const [email,setEmail]=useState('');
  const [error,setError]=useState('');
  const [imports,setImports]=useState<ImportRow[]>([]);
  const [releases,setReleases]=useState<Release[]>([]);
  const [accessRows,setAccessRows]=useState<AccessRow[]>([]);
  const [selectedImport,setSelectedImport]=useState('');
  const [selectedGender,setSelectedGender]=useState('');
  const [preview,setPreview]=useState<{eligible:number;excluded:number}|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [newUserId,setNewUserId]=useState('');
  const [newRole,setNewRole]=useState<Role>('department_viewer');
  const [newSchool,setNewSchool]=useState('');

  const loadAdminData=useCallback(async()=>{
    if(!supabase)return;
    const [i,r,a]=await Promise.all([
      supabase.from('nafs_result_imports').select('id,stage,school_name,imported_at,status').order('imported_at',{ascending:false}).limit(60),
      supabase.from('nafs_publishing_releases').select('*').order('created_at',{ascending:false}).limit(100),
      supabase.from('nafs_publishing_access').select('user_id,role,school_name,active').order('created_at',{ascending:false})
    ]);
    if(i.error)throw i.error;if(r.error)throw r.error;
    setImports((i.data||[]) as ImportRow[]);
    setReleases((r.data||[]) as Release[]);
    if(!a.error)setAccessRows((a.data||[]) as AccessRow[]);
  },[]);

  const verify=useCallback(async()=>{
    if(!supabase){setAccess('unavailable');return;}
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError||!user){setAccess('signed_out');return;}
    setUserId(user.id);setEmail(user.email||'');
    const {data:sys,error:sysError}=await supabase.from('system_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(sysError){setError('تعذر التحقق من الحساب.');setAccess('unavailable');return;}
    const {data:pa,error:paError}=await supabase.from('nafs_publishing_access').select('role,active').eq('user_id',user.id).maybeSingle();
    if(paError){setError('تعذر التحقق من صلاحيات مركز النشر.');setAccess('unavailable');return;}
    const admin=!!sys||!!(pa?.active&&pa.role==='publisher_admin');
    setIsSystemAdmin(!!sys);
    if(!admin&&!pa?.active){setAccess('denied');return;}
    setAccess(admin?'admin':'viewer');
    try{
      if(admin)await loadAdminData();
      else{
        const {data,error:relError}=await supabase.from('nafs_publishing_releases').select('*').eq('status','published').order('published_at',{ascending:false});
        if(relError)throw relError;
        setReleases((data||[]) as Release[]);
      }
    }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل بيانات المركز.');setAccess('unavailable');}
  },[loadAdminData]);

  useEffect(()=>{void verify();},[verify]);

  const loadPreview=async(id:string)=>{
    setSelectedImport(id);setPreview(null);setNotice('');
    if(!supabase||!id)return;
    const {data,error}=await supabase.from('nafs_result_import_rows').select('status,student_name,score,total,answers').eq('import_id',id).limit(2000);
    if(error){setNotice('تعذر قراءة ملخص المصدر: '+error.message);return;}
    const rows=data||[];
    setPreview({eligible:rows.filter(eligible).length,excluded:rows.filter(r=>!eligible(r)).length});
  };

  const createDraft=async()=>{
    if(!supabase||!selectedImport||!preview||preview.eligible<1)return;
    const source=imports.find(x=>x.id===selectedImport);if(!source)return;
    setBusy(true);setNotice('');
    const {data,error:insertError}=await supabase.from('nafs_publishing_releases').insert({
      import_id:source.id,stage:source.stage,school_name:source.school_name,
      gender:selectedGender||null,created_by:userId,status:'draft'
    }).select('*').single();
    if(insertError){setNotice('تعذر إنشاء المسودة: '+insertError.message);setBusy(false);return;}
    const {error:updateError}=await supabase.from('nafs_publishing_releases').update({status:'submitted'}).eq('id',data.id);
    if(updateError){setNotice('أُنشئت المسودة لكن تعذر إرسالها للاعتماد: '+updateError.message);}
    else setNotice('تم إنشاء الإصدار وإرساله للاعتماد. لم يتم نشره.');
    await loadAdminData();setBusy(false);
  };

  const changeStatus=async(release:Release,next:'approved'|'published'|'withdrawn')=>{
    if(!supabase)return;
    setBusy(true);setNotice('');
    const {error}=await supabase.from('nafs_publishing_releases').update({status:next}).eq('id',release.id);
    if(error)setNotice('رفضت قاعدة البيانات العملية: '+error.message);
    else setNotice(next==='approved'?'تم اعتماد الإصدار.':'تم تحديث حالة الإصدار.');
    await loadAdminData();setBusy(false);
  };

  const assignAccess=async()=>{
    if(!supabase||!newUserId.trim())return;
    setBusy(true);setNotice('');
    const payload:any={user_id:newUserId.trim(),role:newRole,school_name:newRole==='school_viewer'?newSchool.trim():null,active:true,created_by:userId};
    const {error}=await supabase.from('nafs_publishing_access').upsert(payload,{onConflict:'user_id'});
    if(error)setNotice('تعذر منح الصلاحية: '+error.message);
    else{setNotice('تم حفظ الصلاحية للحساب الموجود في النظام.');setNewUserId('');setNewSchool('');}
    await loadAdminData();setBusy(false);
  };

  const shell:React.CSSProperties={minHeight:'100vh',background:'linear-gradient(145deg,#071e35,#0b3b55 55%,#0c5961)',padding:'28px 16px',color:'#eff8fb'};
  const card:React.CSSProperties={background:'#fff',color:'#16384a',border:'1px solid #dce8ed',borderRadius:18,padding:20,boxShadow:'0 10px 28px #00172b25'};
  const btn:React.CSSProperties={border:0,borderRadius:10,padding:'10px 15px',background:'#0c6971',color:'#fff',fontWeight:700,cursor:'pointer'};
  const input:React.CSSProperties={width:'100%',padding:11,border:'1px solid #cbd9df',borderRadius:9,background:'#fff',color:'#16384a'};
  const pill=(label:string,bg:string)=> <span style={{display:'inline-block',padding:'5px 10px',borderRadius:30,background:bg,fontSize:12,fontWeight:700}}>{label}</span>;

  return <main dir="rtl" style={shell}><div style={{maxWidth:1180,margin:'0 auto'}}>
    <header style={{textAlign:'center',padding:'14px 8px 26px'}}>
      <div style={{fontSize:13,color:'#c6e1e9'}}>الإدارة العامة للتعليم بنجران · إدارة أداء التعليم</div>
      <h1 style={{fontSize:'clamp(24px,4vw,36px)',color:'#f5d99c',margin:'14px 0 4px'}}>مركز نشر النتائج والخدمات الرقمية</h1>
      <div style={{fontSize:20,fontWeight:700}}>نافس 2026</div>
      <p style={{color:'#c6e1e9',lineHeight:1.8}}>مسار مستقل لاعتماد إصدارات النتائج وإتاحتها للمستفيدين حسب الصلاحيات.</p>
    </header>

    {access==='checking'&&<section style={card}>جارٍ التحقق من الهوية والصلاحيات...</section>}
    {access==='signed_out'&&<section style={card}><h2>تسجيل الدخول مطلوب</h2><p>يلزم الدخول بحساب معتمد للوصول إلى المركز.</p><a href="/" style={btn as any}>الانتقال إلى تسجيل الدخول</a></section>}
    {access==='denied'&&<section style={card}><h2>لا توجد صلاحية</h2><p>هذا الحساب غير مضاف إلى مركز نشر النتائج. يرجى التواصل مع مسؤول النظام.</p></section>}
    {access==='unavailable'&&<section style={card}><h2>تعذر التحقق أو تحميل البيانات</h2><p>{error||'يرجى المحاولة لاحقًا.'}</p></section>}

    {notice&&<div role="status" style={{...card,marginBottom:14,padding:13}}>{notice}</div>}

    {access==='admin'&&<>
      <section style={{...card,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}>
          <div><small style={{color:'#607987'}}>المستخدم الحالي</small><div style={{fontWeight:700}}>{email}</div></div>
          {pill(isSystemAdmin?'مدير نظام':'مدير نشر','#e1f4ec')}
        </div>
        <h2 style={{marginBottom:6}}>إنشاء إصدار نتائج للمراجعة والاعتماد</h2>
        <p style={{color:'#607987',lineHeight:1.8}}>يتم اختيار ملف استيراد محدد. لن تدخل في الإصدار إلا السجلات التي حالتها verified وتحتوي اسمًا ودرجة ومجموعًا وإجابات. السجلات الأخرى تستبعد تلقائيًا.</p>
        <label style={{display:'block',fontWeight:700,margin:'12px 0 6px'}}>مصدر النتائج</label>
        <select value={selectedImport} onChange={e=>void loadPreview(e.target.value)} style={input}>
          <option value="">اختر ملف استيراد...</option>
          {imports.map(i=><option key={i.id} value={i.id}>{stageNames[i.stage]||i.stage} · {i.school_name} · {new Date(i.imported_at).toLocaleDateString('ar-SA')}</option>)}
        </select>
        <label style={{display:'block',fontWeight:700,margin:'12px 0 6px'}}>نطاق الجنس (اختياري)</label>
        <select value={selectedGender} onChange={e=>setSelectedGender(e.target.value)} style={{...input,maxWidth:260}}>
          <option value="">جميع الجنسين حسب بيانات المصدر</option><option value="بنين">بنين</option><option value="بنات">بنات</option>
        </select>
        {preview&&<div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'14px 0'}}>
          <div style={{background:'#e7f5ee',padding:12,borderRadius:10,flex:1,minWidth:130}}><small>سجلات مستوفية مبدئيًا</small><div style={{fontSize:26,fontWeight:800}}>{preview.eligible}</div></div>
          <div style={{background:'#fff2e3',padding:12,borderRadius:10,flex:1,minWidth:130}}><small>سجلات مستبعدة</small><div style={{fontSize:26,fontWeight:800}}>{preview.excluded}</div></div>
        </div>}
        <button disabled={busy||!preview||preview.eligible===0} onClick={()=>void createDraft()} style={{...btn,opacity:busy||!preview||preview.eligible===0?.5:1}}>إنشاء وإرسال للاعتماد</button>
      </section>

      <section style={{...card,marginBottom:16}}>
        <h2>سجل الإصدارات ومسار الاعتماد</h2>
        <p style={{color:'#607987',lineHeight:1.8}}>يلزم اعتماد مستخدم مختلف عن منشئ الإصدار، كما يلزم أن ينفذ النشر مستخدم مختلف عن المعتمد. هذه القيود مطبقة داخل قاعدة البيانات.</p>
        {releases.length===0?<p>لا توجد إصدارات حتى الآن.</p>:<div style={{display:'grid',gap:10}}>
          {releases.map(r=><article key={r.id} style={{border:'1px solid #dce8ed',borderRadius:13,padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
              <strong>{stageNames[r.stage]||r.stage} · {r.school_name}</strong>
              {pill(statusNames[r.status]||r.status,r.status==='published'?'#e1f4ec':r.status==='approved'?'#e7efff':r.status==='submitted'?'#fff1d8':'#edf0f4')}
            </div>
            <div style={{fontSize:13,color:'#607987',marginTop:6}}>السجلات المستوفية: {r.verified_rows} · المستبعدة: {r.excluded_rows} · الجنس: {r.gender||'الكل'}</div>
            <div style={{fontSize:11,color:'#82939c',marginTop:4}}>رقم الإصدار: {r.id}</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
              {r.status==='submitted'&&r.created_by!==userId&&<button disabled={busy} onClick={()=>void changeStatus(r,'approved')} style={btn}>اعتماد الإصدار</button>}
              {r.status==='approved'&&r.approved_by!==userId&&<button disabled={busy} onClick={()=>void changeStatus(r,'published')} style={btn}>نشر الإصدار</button>}
              {['draft','submitted','approved'].includes(r.status)&&<button disabled={busy} onClick={()=>void changeStatus(r,'withdrawn')} style={{...btn,background:'#8c3540'}}>سحب الإصدار</button>}
              {r.status==='submitted'&&r.created_by===userId&&<small style={{alignSelf:'center',color:'#946a22'}}>بانتظار معتمد آخر</small>}
              {r.status==='approved'&&r.approved_by===userId&&<small style={{alignSelf:'center',color:'#946a22'}}>بانتظار ناشر آخر</small>}
            </div>
          </article>)}
        </div>}
      </section>

      {isSystemAdmin&&<section style={card}>
        <h2>إدارة صلاحيات المستفيدين</h2>
        <p style={{color:'#607987',lineHeight:1.8}}>أضف مستخدمًا موجودًا في نظام الدخول باستخدام معرّف حسابه (UUID). منح دور مدير نشر يسمح له بالمراجعة أو النشر، ولا يمنحه إدارة حسابات الصلاحيات.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
          <input value={newUserId} onChange={e=>setNewUserId(e.target.value)} placeholder="معرّف المستخدم UUID" style={input}/>
          <select value={newRole} onChange={e=>setNewRole(e.target.value as Role)} style={input}>
            <option value="department_viewer">مستفيد إدارة أداء التعليم</option><option value="school_viewer">مستفيد مدرسة</option><option value="publisher_admin">مدير اعتماد ونشر</option>
          </select>
          {newRole==='school_viewer'&&<input value={newSchool} onChange={e=>setNewSchool(e.target.value)} placeholder="اسم المدرسة المطابق" style={input}/>}
          <button disabled={busy||!newUserId.trim()||(newRole==='school_viewer'&&!newSchool.trim())} onClick={()=>void assignAccess()} style={btn}>حفظ الصلاحية</button>
        </div>
        <div style={{marginTop:14,display:'grid',gap:7}}>
          {accessRows.map(a=><div key={a.user_id} style={{padding:10,background:'#f4f8fa',borderRadius:9,fontSize:13,display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><span>{a.user_id}</span><span>{a.role==='publisher_admin'?'مدير اعتماد ونشر':a.role==='department_viewer'?'إدارة أداء التعليم':'مدرسة: '+a.school_name}</span><span>{a.active?'نشط':'موقوف'}</span></div>)}
        </div>
      </section>}
    </>}

    {access==='viewer'&&<section style={card}>
      <h2>الإصدارات المنشورة والمتاحة لك</h2>
      <p style={{color:'#607987'}}>تعرض هذه الصفحة الإصدارات المنشورة فقط ضمن نطاق الصلاحية. لا تظهر المسودات أو النتائج المعلقة.</p>
      {releases.length===0?<p>لا توجد نتائج منشورة متاحة لحسابك حاليًا.</p>:releases.map(r=><div key={r.id} style={{border:'1px solid #dce8ed',borderRadius:12,padding:14,marginTop:10}}>
        <strong>{stageNames[r.stage]||r.stage} · {r.school_name}</strong>
        <div style={{marginTop:7}}>عدد السجلات المنشورة: {r.verified_rows} · تاريخ النشر: {r.published_at?new Date(r.published_at).toLocaleDateString('ar-SA'):'-'}</div>
        {pill('منشور ومعتمد','#e1f4ec')}
      </div>)}
    </section>}
    <footer style={{textAlign:'center',color:'#b9d4dd',fontSize:12,padding:'24px 0'}}>نافس 2026 · لا يُعد QR وسيلة تحقق من الهوية · النشر يخضع للاعتماد والصلاحيات</footer>
  </div></main>;
}
