import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const allowedOrigin=(origin:string)=>origin==='https://nafs-grader-najran.vercel.app'||/^https:\/\/nafs-grader-[a-z0-9-]+-najran\.vercel\.app$/.test(origin);
const corsFor=(req:Request)=>({'Access-Control-Allow-Origin':allowedOrigin(req.headers.get('origin')||'')?req.headers.get('origin')!:'https://nafs-grader-najran.vercel.app','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
Deno.serve(async(req:Request)=>{
 const cors=corsFor(req);
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'طلب غير صالح'},405);
 try{
  if(Number(req.headers.get('content-length'))>200000)return reply({error:'الملف أكبر من المسموح'},413);
  const raw=await req.text();if(raw.length>200000)return reply({error:'الملف أكبر من المسموح'},413);
  const body=JSON.parse(raw);
  // Existing public school print workflow: insert-only roster enrollment;
  // never disclose, replace, transfer or delete an existing student's data.
  if(!/^[0-9a-f-]{36}$/i.test(body.school||'')||!Array.isArray(body.students)||body.students.length>250)return reply({error:'اختر المدرسة وتحقق من ملف الطلاب'},400);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const {data,error}=await db.rpc('register_school_roster',{p_school:body.school,p_students:body.students,p_grade:typeof body.grade==='string'?body.grade:'',p_client:hash});
  if(error){console.error('school-roster RPC failure',{code:error.code,message:error.message});const message=error.code==='23505'?'يوجد سجل مدني مكرر أو مرتبط ببيانات سابقة؛ راجع مدير النظام دون حذف بيانات الطلاب':error.code==='23503'?'بيانات المدرسة أو أحد الطلاب مرتبطة بسجل غير صالح؛ راجع مدير النظام':error.code==='23514'?'بعض بيانات الطلاب لا تستوفي شروط الحفظ؛ تحقق من السجلات والأسماء':error.code==='42501'?'تعذر حفظ الطلاب بسبب صلاحيات قاعدة البيانات؛ تواصل مع مدير النظام':'تعذر حفظ بيانات الطلاب في قاعدة البيانات (رمز '+String(error.code||'غير معروف')+')؛ تواصل مع مدير النظام';return reply({error:message},400)}
  return reply(data);
 }catch{return reply({error:'تعذر قراءة بيانات الطلاب'},400)}
});
