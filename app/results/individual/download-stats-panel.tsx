'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from '../../../lib/supabase';
type Stats={total:number;today:number;thisMonth:number;byStage:{stage:string;label:string;count:number}[];topSchools:{school:string;stage:string;count:number}[];recent:{at:string;stage:string;school:string;gender:string;students:number;file:string}[];limited:boolean};
export default function DownloadStatsPanel(){
 const [stats,setStats]=useState<Stats|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{try{if(!supabase)throw Error('اتصال قاعدة البيانات غير متاح');const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('يلزم تسجيل دخول المدير');const r=await fetch('/api/results/individual/download-stats',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});const b=await r.json();if(!r.ok)throw Error(b.error||'تعذر تحميل الإحصاءات');setStats(b);setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}},[]);
 useEffect(()=>{void load()},[load]);
 const panel:React.CSSProperties={padding:20,border:'1px solid #2783a0',borderRadius:20,background:'#052943eF',marginBottom:20};
 const metric:React.CSSProperties={padding:15,border:'1px solid #28637b',borderRadius:14,background:'#073550',minWidth:130};
 return <section dir="rtl" style={panel}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><h2 style={{margin:0,fontSize:21}}>إحصاءات تنزيل Excel</h2><p style={{margin:'5px 0 0',color:'#b8dbe5',fontSize:13}}>سجل التنزيلات من صفحة النتائج الفردية · ثالث ابتدائي وسادس ابتدائي وثالث متوسط</p></div><button onClick={()=>void load()} style={{border:0,borderRadius:10,padding:'9px 14px',fontWeight:800,cursor:'pointer',background:'#0b7187',color:'#fff'}}>تحديث الإحصاءات ↻</button></div>
 {error&&<p role="alert" style={{color:'#ffd0c8'}}>{error}</p>}
 {stats&&<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginTop:16}}>{[{label:'إجمالي التنزيلات',value:stats.total},{label:'اليوم',value:stats.today},{label:'هذا الشهر',value:stats.thisMonth}].map(x=><div key={x.label} style={metric}><div style={{fontSize:12,color:'#b8dbe5'}}>{x.label}</div><strong style={{display:'block',fontSize:27,color:'#ffe6a4',marginTop:5}}>{x.value.toLocaleString('ar-SA')}</strong></div>)}</div>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}>{stats.byStage.map(x=><span key={x.stage} style={{padding:'8px 12px',borderRadius:10,background:'#104b67',color:'#e5f8ff'}}>{x.label}: <b>{x.count.toLocaleString('ar-SA')}</b></span>)}</div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:16,marginTop:18}}><div><h3 style={{fontSize:15}}>أكثر المدارس تنزيلًا</h3>{stats.topSchools.length?stats.topSchools.map((x,i)=><div key={x.stage+x.school} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'7px 0',borderBottom:'1px solid #24546b',fontSize:13}}><span>{i+1}. {x.school} <small style={{color:'#a9d1dd'}}>({x.stage})</small></span><b>{x.count}</b></div>):<p style={{color:'#b8dbe5'}}>لا توجد تنزيلات مسجلة بعد.</p>}</div>
 <div><h3 style={{fontSize:15}}>آخر عمليات التنزيل</h3>{stats.recent.length?stats.recent.slice(0,8).map((x,i)=><div key={x.at+i} style={{padding:'7px 0',borderBottom:'1px solid #24546b',fontSize:12}}><b>{x.school}</b><div style={{color:'#b8dbe5'}}>{x.stage} · {x.gender} · {x.students} طالب · {new Date(x.at).toLocaleString('ar-SA')}</div></div>):<p style={{color:'#b8dbe5'}}>لا توجد تنزيلات مسجلة بعد.</p>}</div></div>
 {stats.limited&&<p style={{color:'#ffe6a4',fontSize:12}}>عرض آخر 5000 سجل؛ الإجمالي يعكس العدد الكلي.</p>}</>}
 </section>;
}
