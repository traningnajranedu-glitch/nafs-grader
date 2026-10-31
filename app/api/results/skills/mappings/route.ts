import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '../../../../../lib/google-drive-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function admin(req:NextRequest){await requireAdmin(req.headers.get('authorization'));return serviceDb()}
export async function GET(req:NextRequest){try{const db=await admin(req);const {data,error}=await db.from('nafs_question_skills').select('stage,gender,subject,question_number,skill_code,skill_name,correct_answer').order('question_number').limit(1000);if(error)throw Error(error.message);return NextResponse.json({mappings:data||[]})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Forbidden'},{status:403})}}
export async function POST(req:NextRequest){try{const db=await admin(req),body=await req.json();const stage=String(body.stage||''),gender=String(body.gender||''),subject=String(body.subject||''),skill_name=String(body.skill_name||'').trim(),skill_code=String(body.skill_code||'').trim(),questions=body.questions;
 if(!stage||!gender||!subject||!skill_name||!skill_code||!Array.isArray(questions)||questions.length<1||questions.length>100||questions.some((x:unknown)=>!Number.isInteger(x)||Number(x)<1)||new Set(questions).size!==questions.length)return NextResponse.json({error:'بيانات ربط المهارة غير مكتملة'},{status:400});
 const records=questions.map((question_number:number)=>({stage,gender,subject,question_number,skill_code,skill_name,correct_answer:null}));
 const {error}=await db.from('nafs_question_skills').upsert(records,{onConflict:'stage,gender,subject,question_number'});if(error)throw Error(error.message);return NextResponse.json({saved:records.length})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to save'},{status:403})}}
