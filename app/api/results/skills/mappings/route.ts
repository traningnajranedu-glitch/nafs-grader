import {NextRequest,NextResponse} from 'next/server';
import {serviceDb} from '../../../../../lib/google-drive-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function access(req:NextRequest){
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)throw Error('Login required');
 const db=serviceDb(),{data:{user},error}=await db.auth.getUser(token);
 if(error||!user)throw Error('Invalid session');
 const {data:admin,error:adminError}=await db.from('system_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(adminError)throw Error('Unable to verify permissions');
 if(admin)return {db,role:'admin',school_id:null as string|null,subject:null as string|null};
 const {data:staff,error:staffError}=await db.from('nafs_skills_staff').select('role,school_id,subject,active').eq('user_id',user.id).maybeSingle();
 if(staffError||!staff?.active)throw Error('Account inactive or unauthorized');
 return {db,role:staff.role as string,school_id:staff.school_id as string,subject:staff.subject as string|null};
}
export async function GET(req:NextRequest){
 try{const a=await access(req);let q=a.db.from('nafs_question_skills').select('stage,gender,subject,question_number,skill_code,skill_name').order('question_number').limit(1000);
 if(a.role==='teacher'){if(!a.subject)throw Error('Subject not assigned');q=q.eq('subject',a.subject)}
 const {data,error}=await q;if(error)throw Error(error.message);
 return NextResponse.json({mappings:data||[],role:a.role},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Forbidden'},{status:403})}
}
export async function POST(req:NextRequest){
 try{const a=await access(req);if(!['admin','teacher'].includes(a.role))return NextResponse.json({error:'ليس لديك صلاحية تعديل المهارات'},{status:403});
 const body=await req.json(),stage=String(body.stage||''),gender=String(body.gender||''),subject=String(body.subject||''),skill_name=String(body.skill_name||'').trim(),skill_code=String(body.skill_code||'').trim(),questions=body.questions;
 if(!['primary3','primary6','middle3'].includes(stage)||!['boys','girls','بنين','بنات'].includes(gender)||!subject||!skill_name||!skill_code||!Array.isArray(questions)||questions.length<1||questions.length>100||questions.some((x:unknown)=>!Number.isInteger(x)||Number(x)<1||Number(x)>200)||new Set(questions).size!==questions.length)return NextResponse.json({error:'بيانات المهارة غير صالحة'},{status:400});
 if(a.role==='teacher'&&a.subject!==subject)return NextResponse.json({error:'لا يمكن تعديل مهارات مادة أخرى'},{status:403});
 // Existing answer keys must never be overwritten by skill mapping updates.
 const {data:existing,error:readError}=await a.db.from('nafs_question_skills').select('question_number,correct_answer').eq('stage',stage).eq('gender',gender).eq('subject',subject).in('question_number',questions);
 if(readError)throw Error(readError.message);
 const key=new Map((existing||[]).map(r=>[r.question_number,r.correct_answer]));
 const records=questions.map((question_number:number)=>({stage,gender,subject,question_number,skill_code,skill_name,correct_answer:key.get(question_number)??null}));
 const {error}=await a.db.from('nafs_question_skills').upsert(records,{onConflict:'stage,gender,subject,question_number'});if(error)throw Error(error.message);
 return NextResponse.json({saved:records.length});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to save'},{status:403})}
}