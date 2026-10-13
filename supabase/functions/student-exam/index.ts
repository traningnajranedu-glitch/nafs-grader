import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cors={'Access-Control-Allow-Origin':'https://nafs-grader-najran.vercel.app','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
Deno.serve(async(req:Request)=>{
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'طريقة طلب غير صالحة'},405);
 try{
  const raw=await req.text();if(raw.length>16000)return reply({error:'طلب أكبر من المسموح'},413);
  const body=JSON.parse(raw);if(!['login','open','submit'].includes(body.action))return reply({error:'طلب غير صالح'},400);
  // Civil ID establishes entry; a random expiring capability authorizes open/submit.
  if(body.action!=='login'&&!/^[0-9a-f-]{36}$/i.test(body.token||''))return reply({error:'أعد تسجيل الدخول'},401);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const {data,error}=await db.rpc('student_exam_gateway',{p_action:body.action,p_code:body.action==='login'?body.code:null,p_token:body.action==='login'?null:body.token,p_exam:body.exam||null,p_answers:body.answers||null,p_client:hash});
  if(error)return reply({error:'تعذر تنفيذ الطلب؛ تحقق من البيانات وأعد المحاولة'},400);
  return reply(data);
 }catch{return reply({error:'تعذر قراءة الطلب؛ أعد المحاولة'},400)}
});
