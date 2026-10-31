import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '../../../../../lib/google-drive-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function guard(req:NextRequest){await requireAdmin(req.headers.get('authorization'));return serviceDb()}
export async function GET(req:NextRequest){
 try{const db=await guard(req);const [staff,schools]=await Promise.all([db.from('nafs_skills_staff').select('user_id,school_id,role,full_name,subject,active,created_at').order('created_at',{ascending:false}),db.from('schools').select('id,name').order('name')]);if(staff.error||schools.error)throw Error(staff.error?.message||schools.error?.message);return NextResponse.json({staff:staff.data,schools:schools.data})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unauthorized'},{status:403})}
}
export async function POST(req:NextRequest){
 try{const db=await guard(req);const body=await req.json();const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||''),full_name=String(body.full_name||'').trim(),school_id=String(body.school_id||''),role=String(body.role||''),subject=String(body.subject||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||!full_name||!['teacher','principal'].includes(role)||!school_id||(role==='teacher'&&!subject))return NextResponse.json({error:'تحقق من الحقول وكلمة المرور (12 حرفًا على الأقل)'},{status:400});
 const school=await db.from('schools').select('id').eq('id',school_id).maybeSingle();if(school.error||!school.data)return NextResponse.json({error:'المدرسة غير موجودة'},{status:400});
 const created=await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{nafs_staff:true}});if(created.error||!created.data.user)return NextResponse.json({error:created.error?.message||'تعذر إنشاء الحساب'},{status:400});
 const user_id=created.data.user.id;const inserted=await db.from('nafs_skills_staff').insert({user_id,school_id,role,full_name,subject:role==='teacher'?subject:null});
 if(inserted.error){await db.auth.admin.deleteUser(user_id);throw Error(inserted.error.message)}
 return NextResponse.json({user_id,created:true},{status:201});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر إنشاء الحساب'},{status:403})}
}
export async function PATCH(req:NextRequest){
 try{const db=await guard(req),body=await req.json();if(typeof body.user_id!=='string'||typeof body.active!=='boolean')return NextResponse.json({error:'Invalid request'},{status:400});const r=await db.from('nafs_skills_staff').update({active:body.active}).eq('user_id',body.user_id).select('user_id,active').single();if(r.error)throw Error(r.error.message);return NextResponse.json(r.data)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Forbidden'},{status:403})}
}