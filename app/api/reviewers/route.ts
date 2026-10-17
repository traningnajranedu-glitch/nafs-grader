import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
function fail(message:string,status=400){return NextResponse.json({error:message},{status})}
export async function POST(req:NextRequest){
 if(!url||!service)return fail('إعدادات خادم إدارة المصححين غير مكتملة: SUPABASE_SERVICE_ROLE_KEY',503);
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)return fail('يجب تسجيل دخول مدير النظام',401);
 const adminClient=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await adminClient.auth.getUser(token);
 if(authError||!user)return fail('جلسة غير صالحة',401);
 const {data:admin,error:adminError}=await adminClient.from('system_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(adminError||!admin)return fail('العملية لمدير النظام فقط',403);
 let body:{action?:string;username?:string;password?:string;full_name?:string;user_id?:string;school_ids?:string[];active?:boolean};
 try{body=await req.json()}catch{return fail('بيانات الطلب غير صالحة')}
 try{
 if(body.action==='create'){
 const username=String(body.username||'').trim().toLowerCase();
 const full_name=String(body.full_name||'').trim();
 if(!/^[a-z0-9._-]{3,40}$/.test(username)||full_name.length<2||String(body.password||'').length<10)return fail('أدخل اسمًا صحيحًا واسم مستخدم إنجليزي (3 أحرف فأكثر) وكلمة مرور من 10 أحرف فأكثر');
 const email=username+'@reviewers.nafs.invalid';
 const created=await adminClient.auth.admin.createUser({email,password:body.password,email_confirm:true,user_metadata:{full_name,role:'nafs_reviewer'}});
 if(created.error||!created.data.user)return fail(created.error?.message||'تعذر إنشاء الحساب');
 const uid=created.data.user.id;
 const saved=await adminClient.from('nafs_reviewers').insert({user_id:uid,username,full_name}).select().single();
 if(saved.error){await adminClient.auth.admin.deleteUser(uid);return fail(saved.error.message)}
 return NextResponse.json({reviewer:saved.data});
 }
 if(body.action==='assign'){
 const id=String(body.user_id||'');
 const ids=[...new Set((body.school_ids||[]).filter(x=>/^[0-9a-f-]{36}$/i.test(x)))];
 const reviewer=await adminClient.from('nafs_reviewers').select('user_id').eq('user_id',id).maybeSingle();
 if(!reviewer.data)return fail('المصحح غير موجود');
 const existing=await adminClient.from('nafs_reviewer_schools').select('school_id').eq('reviewer_id',id);
 if(existing.error)return fail(existing.error.message);
 const before=(existing.data||[]).map(x=>x.school_id);
 const toAdd=ids.filter(x=>!before.includes(x));
 if(toAdd.length){const a=await adminClient.from('nafs_reviewer_schools').insert(toAdd.map(school_id=>({reviewer_id:id,school_id})));if(a.error)return fail(a.error.message)}
 const toRemove=before.filter(x=>!ids.includes(x));
 if(toRemove.length){const d=await adminClient.from('nafs_reviewer_schools').delete().eq('reviewer_id',id).in('school_id',toRemove);if(d.error)return fail(d.error.message)}
 return NextResponse.json({ok:true});
 }
 if(body.action==='status'){
 const r=await adminClient.from('nafs_reviewers').update({active:!!body.active}).eq('user_id',body.user_id).select('user_id').single();
 if(r.error)return fail(r.error.message);
 return NextResponse.json({ok:true});
 }
 return fail('إجراء غير معروف');
 }catch(e){return fail(e instanceof Error?e.message:'تعذر تنفيذ الطلب',500)}
}
