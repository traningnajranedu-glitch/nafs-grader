'use client';
import {useEffect,useMemo,useState} from 'react';
import * as XLSX from 'xlsx';
import {supabase} from '../../lib/supabase';
import {UiIcon} from '../components/ui-icon';
type Row={id:string;school_name:string|null;student_code:string|null;student_name:string|null;stage:string|null;grade:string|null;score:number|null;total:number|null;verified_at:string|null};
const norm=(v:unknown)=>String(v??'').trim().replace(/\s+/g,' ').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
export default function SchoolReports(){
 const [authorized,setAuthorized]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[rows,setRows]=useState<Row[]>([]),[schools,setSchools]=useState<{name:string;gender:string|null;stage:string|null}[]>([]);
 const [school,setSchool]=useState(''),[stage,setStage]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{
 if(!supabase)throw Error('الاتصال بقاعدة البيانات غير متاح');
 const auth=await supabase.auth.getUser();if(!auth.data.user)throw Error('سجّل الدخول أولًا');
 const admin=await supabase.from('system_admins').select('user_id').eq('user_id',auth.data.user.id).maybeSingle();
 if(admin.error)throw admin.error;if(!admin.data)throw Error('هذه الصفحة متاحة لمدير النظام فقط');
 if(!active)return;setAuthorized(true);
 const schoolResult=await supabase.from('schools').select('name,gender,stage');
 if(schoolResult.error)throw schoolResult.error;
 const data:Row[]=[];
 for(let i=0;i<100000;i+=1000){
 const result=await supabase.from('nafs_scanned_corrections').select('id,school_name,student_code,student_name,stage,grade,score,total,verified_at').order('corrected_at',{ascending:false}).range(i,i+999);
 if(result.error)throw result.error;data.push(...(result.data||[]));if((result.data||[]).length<1000)break;
 }
 if(active){setSchools(schoolResult.data||[]);setRows(data)}
 }catch(e){if(active)setError(e instanceof Error?e.message:String(e))}finally{if(active)setLoading(false)}})();return()=>{active=false}},[]);
 const records=useMemo(()=>{const seen=new Set<string>();return rows.filter(r=>{if(!r.verified_at)return false;const key=[norm(r.school_name),r.student_code||r.student_name,r.id].join('|');if(seen.has(key))return false;seen.add(key);return true})},[rows]);
 const filtered=useMemo(()=>records.filter(r=>(!school||norm(r.school_name)===school)&&(!stage||r.stage===stage)),[records,school,stage]);
 const groups=useMemo(()=>{const map=new Map<string,{name:string;count:number;sum:number;mastered:number}>();for(const r of filtered){const key=norm(r.school_name)||'غير محددة';const entry=map.get(key)||{name:r.school_name||'غير محددة',count:0,sum:0,mastered:0};if(Number(r.total)>0){const p=100*Number(r.score)/Number(r.total);entry.count++;entry.sum+=p;if(p>=80)entry.mastered++}map.set(key,entry)}return [...map.values()].sort((a,b)=>(b.count?b.sum/b.count:0)-(a.count?a.sum/a.count:0))},[filtered]);
 const scored=filtered.filter(r=>Number(r.total)>0);const average=scored.length?scored.reduce((s,r)=>s+100*Number(r.score)/Number(r.total),0)/scored.length:0;
 const mastered=scored.filter(r=>100*Number(r.score)/Number(r.total)>=80).length;
 const stages=[...new Set(records.map(r=>r.stage).filter(Boolean))] as string[];
 function exportExcel(){const wb=XLSX.utils.book_new();wb.Workbook={Views:[{RTL:true}]};XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(groups.map((g,i)=>({'الترتيب':i+1,'المدرسة':g.name,'الطلاب المصححون':g.count,'المتوسط %':g.count?+(g.sum/g.count).toFixed(2):0,'الإتقان %':g.count?+(100*g.mastered/g.count).toFixed(2):0}))), 'المدارس');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(filtered.map(r=>({'المدرسة':r.school_name,'الطالب':r.student_name,'رقم الطالب':r.student_code,'المرحلة':r.stage,'الصف':r.grade,'الدرجة':r.score,'الدرجة الكلية':r.total,'النسبة %':Number(r.total)>0?+(100*Number(r.score)/Number(r.total)).toFixed(2):''}))), 'النتائج');XLSX.writeFile(wb,'nafs-school-reports.xlsx')}
 const card:React.CSSProperties={background:'white',border:'1px solid #dce8e8',borderRadius:16,padding:20};
 return <main dir="rtl" style={{minHeight:'100vh',background:'#f4f8f8',padding:'28px max(20px,5vw)',color:'#173b45',fontFamily:'inherit'}}>
 <a href="/workspace" style={{color:'#087e83'}}>← العودة للوحة مدير النظام</a><h1 style={{display:'flex',alignItems:'center',gap:12}}><UiIcon name="kpi" size={32}/> إحصائيات وتقارير أولية</h1>
 <p>مؤشرات مبنية على نتائج التصحيح المعتمدة فقط. حد الإتقان المعروض 80% ويمكن تطويره لاحقًا وفق سياسة الاختبار.</p>
 {loading?<p>جارٍ تحميل الإحصائيات...</p>:error?<p role="alert" style={{color:'#b91c1c'}}>{error}</p>:authorized?<><section style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:22}}>
 <select aria-label="المدرسة" value={school} onChange={e=>setSchool(e.target.value)} style={{padding:12,borderRadius:10}}><option value="">جميع المدارس</option>{[...new Set([...schools.map(s=>norm(s.name)),...records.map(r=>norm(r.school_name))])].filter(Boolean).sort().map(n=><option key={n} value={n}>{schools.find(s=>norm(s.name)===n)?.name||records.find(r=>norm(r.school_name)===n)?.school_name}</option>)}</select>
 <select aria-label="المرحلة" value={stage} onChange={e=>setStage(e.target.value)} style={{padding:12,borderRadius:10}}><option value="">جميع المراحل</option>{stages.map(s=><option key={s}>{s}</option>)}</select>
 <button onClick={exportExcel} style={{background:'#087e83',color:'white',border:0,borderRadius:10,padding:'12px 20px',cursor:'pointer'}}>تصدير Excel</button>
 <button onClick={()=>window.print()} style={{background:'#e1efee',border:0,borderRadius:10,padding:'12px 20px',cursor:'pointer'}}>طباعة / PDF</button></section>
 <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:14,marginBottom:24}}>
 {[['إجمالي المدارس',schools.length],['المدارس ذات النتائج',groups.filter(g=>g.count).length],['النتائج المعتمدة',filtered.length],['متوسط الدرجات',average.toFixed(1)+'%'],['نسبة الإتقان',scored.length?(100*mastered/scored.length).toFixed(1)+'%':'—'],['بانتظار الاعتماد',rows.length-records.length]].map(([label,value])=><article key={label} style={card}><div style={{fontSize:13,color:'#57717a'}}>{label}</div><strong style={{fontSize:29}}>{value}</strong></article>)}</section>
 <section style={card}><h2>ترتيب المدارس حسب متوسط النتائج</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'right'}}><thead><tr>{['م','المدرسة','الطلاب المصححون','متوسط الدرجات','نسبة الإتقان'].map(h=><th key={h} style={{padding:12,borderBottom:'2px solid #dce8e8'}}>{h}</th>)}</tr></thead><tbody>{groups.map((g,i)=><tr key={g.name}>{[i+1,g.name,g.count,g.count?(g.sum/g.count).toFixed(1)+'%':'—',g.count?(100*g.mastered/g.count).toFixed(1)+'%':'—'].map((v,j)=><td key={j} style={{padding:12,borderBottom:'1px solid #e6eeee'}}>{v}</td>)}</tr>)}</tbody></table>{!groups.length&&<p>لا توجد نتائج معتمدة ضمن الفلاتر المحددة.</p>}</div></section></>:null}</main>
}