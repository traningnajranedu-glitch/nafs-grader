import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const statuses=['new','in_progress','waiting_school','resolved','closed'];
const priorities=['normal','high','urgent'];
const ticketFields='id,number,school_id,reporter_name,phone,service,kind,title,status,priority,resolution,rating,created_at,updated_at,schools(name,gender,stage)';
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const secret=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
function text(v:unknown,min:number,max:number){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw Error('تحقق من الحقول المطلوبة وطول النص');return v.trim()}
function check(error:any){if(error){console.error('school-support database error',{code:error.code,message:error.message});if(error.message?.includes('rate_limit'))throw Error('بلغت الحد المسموح للمحاولات؛ حاول لاحقًا');if(error.message?.includes('solution_required'))throw Error('سجل الحل قبل اعتماد الحل أو الإغلاق');if(error.message?.includes('reopen_first'))throw Error('أعد فتح البلاغ أولًا');throw Error('تعذر حفظ التحديث؛ حدّث البلاغ وحاول مجددًا')}}
async function adminUser(req:Request){const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)throw Error('يلزم تسجيل الدخول بحساب مدير النظام');const r=await db.auth.getUser(token);if(r.error||!r.data.user)throw Error('يلزم تسجيل الدخول بحساب مدير النظام');const a=await db.from('system_admins').select('user_id').eq('user_id',r.data.user.id).maybeSingle();if(a.error||!a.data)throw Error('الخدمة متاحة لمدير النظام فقط');return r.data.user.id}
async function authorizedTicket(body:any,isAdmin:boolean){if(!uuid(body.ticket))throw Error('رقم البلاغ غير صالح');let q=db.from('support_tickets').select(ticketFields).eq('id',body.ticket);if(!isAdmin){if(!secret(body.secret))throw Error('رمز المتابعة غير صالح');q=q.eq('access_hash',await hash(body.secret))}const r=await q.maybeSingle();check(r.error);if(!r.data)throw Error('لم يُعثر على البلاغ أو رمز المتابعة غير صحيح');return r.data}
async function attachment(input:any,ticket:string,message:string){
 if(!input)return {};
 const name=text(input.name,1,180);if(typeof input.data!=='string'||input.data.length>7000000)throw Error('حجم المرفق الأقصى 5 ميجابايت');
 let raw:string;try{raw=atob(input.data)}catch{throw Error('تعذر قراءة المرفق')}
 const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(!bytes.length||bytes.length>5242880)throw Error('حجم المرفق الأقصى 5 ميجابايت');
 let mime='',ext='';if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10){mime='image/png';ext='png'}else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';ext='jpg'}else if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'){mime='application/pdf';ext='pdf'}else throw Error('المرفقات المسموحة: PNG أو JPG أو PDF');
 const path=ticket+'/'+message+'.'+ext;
 const r=await db.storage.from('support-attachments').upload(path,bytes,{contentType:mime,upsert:false});check(r.error);
 return {attachment_path:path,attachment_name:name,attachment_mime:mime};
}
async function detail(ticket:any,isAdmin:boolean){let q=db.from('support_messages').select('id,author_role,internal,body,attachment_path,attachment_name,attachment_mime,status_change,created_at').eq('ticket_id',ticket.id).order('created_at');if(!isAdmin)q=q.eq('internal',false);const r=await q;check(r.error);const messages=await Promise.all((r.data||[]).map(async m=>{let attachment_url=null;if(m.attachment_path){const url=await db.storage.from('support-attachments').createSignedUrl(m.attachment_path,600);if(!url.error)attachment_url=url.data.signedUrl}const {attachment_path,...publicMessage}=m;return {...publicMessage,attachment_url}}));return {ticket,messages}}
Deno.serve(async(req:Request)=>{
 const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'طلب غير صالح'},405);
 try{
  if(Number(req.headers.get('content-length'))>7200000)return reply({error:'حجم الطلب أكبر من المسموح'},413);
  const raw=await req.text();if(raw.length>7200000)return reply({error:'حجم الطلب أكبر من المسموح'},413);const b=JSON.parse(raw);
  const isAdmin=typeof b.action==='string'&&b.action.startsWith('admin_');const actor=isAdmin?await adminUser(req):null;
  if(b.action==='create'){
   if(!uuid(b.ticket)||!uuid(b.message_id)||!uuid(b.school)||!secret(b.secret))throw Error('اختر المدرسة من القائمة قبل رفع البلاغ');
   const phone=text(b.phone,10,15).replace(/[^0-9]/g,'').replace(/^00966/,'966').replace(/^05/,'9665');if(!/^9665\d{8}$/.test(phone))throw Error('أدخل رقم واتساب سعوديًا صحيحًا');
   if(!['استيراد الطلاب','إصدار PDF','طباعة النماذج','أخرى'].includes(b.service)||!['مشكلة تقنية','مشكلة بيانات','استفسار','اقتراح'].includes(b.kind))throw Error('اختر الخدمة ونوع البلاغ');
   const reporter=text(b.reporter_name,2,120),title=text(b.title,5,160),description=text(b.body,10,6000);
   const access=await hash(b.secret);const existing=await db.from('support_tickets').select('id,access_hash').eq('id',b.ticket).maybeSingle();check(existing.error);if(existing.data){if(existing.data.access_hash!==access)throw Error('طلب غير صالح');return reply(await detail(await authorizedTicket(b,false),false))}
   const s=await db.from('schools').select('id').eq('id',b.school).maybeSingle();if(s.error||!s.data)throw Error('اختر المدرسة من القائمة قبل رفع البلاغ');
   // Proxy-provided client IP is salted so raw addresses are never stored.
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';const client=await hash(ip+':'+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
   const quota=await db.from('support_tickets').select('id',{count:'exact',head:true}).eq('client_hash',client).gte('created_at',new Date(Date.now()-3600000).toISOString());check(quota.error);if((quota.count||0)>=10)throw Error('بلغت الحد المسموح للبلاغات؛ حاول لاحقًا');
   const file=await attachment(b.attachment,b.ticket,b.message_id);
   const result=await db.rpc('support_open_ticket',{p_ticket:{id:b.ticket,access_hash:access,school_id:b.school,reporter_name:reporter,phone,service:b.service,kind:b.kind,title,client_hash:client},p_message:{id:b.message_id,body:description,...file}});
   if(result.error&&file.attachment_path)await db.storage.from('support-attachments').remove([file.attachment_path]);check(result.error);return reply(await detail(await authorizedTicket(b,false),false));
  }
  if(b.action==='owned'){
   if(!uuid(b.school)||!Array.isArray(b.secrets)||b.secrets.length>100||b.secrets.some((x:unknown)=>!secret(x)))throw Error('بيانات المتابعة غير صالحة');if(!b.secrets.length)return reply({tickets:[]});const hashes=await Promise.all(b.secrets.map(hash));const r=await db.from('support_tickets').select(ticketFields).eq('school_id',b.school).in('access_hash',hashes).order('updated_at',{ascending:false});check(r.error);return reply({tickets:r.data});
  }
  if(b.action==='admin_list'){
   let q=db.from('support_tickets').select(ticketFields,{count:'exact'});
   if(b.school){if(!uuid(b.school))throw Error('المدرسة غير صالحة');q=q.eq('school_id',b.school)}
   if(b.status){if(!statuses.includes(b.status))throw Error('الحالة غير صالحة');q=q.eq('status',b.status)}
   if(b.priority){if(!priorities.includes(b.priority))throw Error('الأولوية غير صالحة');q=q.eq('priority',b.priority)}
   if(b.service)q=q.eq('service',text(b.service,1,80));
   if(b.since){if(!/^\d{4}-\d{2}-\d{2}$/.test(b.since)||Number.isNaN(Date.parse(b.since)))throw Error('التاريخ غير صالح');q=q.gte('created_at',b.since+'T00:00:00+03:00')}
   const offset=Number.isInteger(b.offset)&&b.offset>=0?Math.min(b.offset,100000):0;
   const [list,...counts]=await Promise.all([q.order('updated_at',{ascending:false}).range(offset,offset+49),...statuses.map(s=>db.from('support_tickets').select('id',{count:'exact',head:true}).eq('status',s)),db.from('support_tickets').select('id',{count:'exact',head:true}).not('status','in','(resolved,closed)').lt('updated_at',new Date(Date.now()-48*3600000).toISOString())]);check(list.error);counts.forEach(r=>check(r.error));return reply({tickets:list.data,count:list.count,stats:Object.fromEntries([...statuses,'overdue'].map((s,i)=>[s,counts[i].count||0]))});
  }
  if(['detail','admin_detail'].includes(b.action))return reply(await detail(await authorizedTicket(b,isAdmin),isAdmin));
  if(['reply','admin_reply'].includes(b.action)){
   const ticket=await authorizedTicket(b,isAdmin);if(!uuid(b.message_id))throw Error('معرّف الرد غير صالح');
   const content=text(b.body,1,6000);const internal=isAdmin&&b.internal===true;
   if(b.status!=null&&!statuses.includes(b.status))throw Error('الحالة غير صالحة');if(b.priority!=null&&!priorities.includes(b.priority))throw Error('الأولوية غير صالحة');
   if(!isAdmin&&(b.internal||b.priority!=null||b.resolution!=null||b.status!=null&&!['closed','in_progress'].includes(b.status)))throw Error('التحديث غير مسموح');
   if(b.rating!=null&&(!Number.isInteger(b.rating)||b.rating<1||b.rating>5))throw Error('التقييم من 1 إلى 5');
   if(internal&&(b.status!=null&&b.status!==ticket.status||b.resolution!=null))throw Error('أرسل الحل أو تغيير الحالة كرد ظاهر للمدرسة');
   const existing=await db.from('support_messages').select('id').eq('id',b.message_id).eq('ticket_id',ticket.id).maybeSingle();check(existing.error);if(existing.data)return reply(await detail(await authorizedTicket(b,isAdmin),isAdmin));
   const file=await attachment(b.attachment,ticket.id,b.message_id);
   const r=await db.rpc('support_append_message',{p_ticket:ticket.id,p_admin:isAdmin,p_message:{id:b.message_id,body:content,internal,actor_id:actor,...file},p_status:b.status??null,p_priority:b.priority??null,p_resolution:isAdmin&&b.resolution!=null?text(b.resolution,1,6000):null,p_rating:b.rating??null});
   if(r.error&&file.attachment_path)await db.storage.from('support-attachments').remove([file.attachment_path]);check(r.error);return reply(await detail(await authorizedTicket(b,isAdmin),isAdmin));
  }
  throw Error('طلب غير صالح');
 }catch(e){return reply({error:e instanceof Error?e.message:'تعذر تنفيذ الطلب'},400)}
});
