import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!service)return NextResponse.json({error:'إعدادات الخادم غير مكتملة'},{status:503});
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)return NextResponse.json({error:'يلزم تسجيل الدخول'},{status:401});
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return NextResponse.json({error:'جلسة غير صالحة'},{status:401});
 const reviewer=await db.from('nafs_reviewers').select('active').eq('user_id',user.id).maybeSingle();
 if(reviewer.error||!reviewer.data?.active)return NextResponse.json({error:'حساب المصحح غير مفعل'},{status:403});
 const assignments=await db.from('nafs_reviewer_exams').select('exam_id').eq('reviewer_id',user.id);
 if(assignments.error)return NextResponse.json({error:assignments.error.message},{status:500});
 const ids=(assignments.data||[]).map(x=>x.exam_id);
 if(!ids.length)return NextResponse.json({exams:[],questions:[],reason:'no_assignments'});
 const exams=await db.from('exams').select('id,title,school_id,subject,grade').in('id',ids).eq('status','approved').is('deleted_at',null);
 if(exams.error)return NextResponse.json({error:exams.error.message},{status:500});
 const approved=(exams.data||[]).map(x=>x.id);
 if(!approved.length)return NextResponse.json({exams:[],questions:[],reason:'no_approved_exams'});
 const questions=await db.from('exam_questions').select('id,exam_id,question_number,correct_option,points').in('exam_id',approved);
 if(questions.error)return NextResponse.json({error:questions.error.message},{status:500});
 return NextResponse.json({exams:exams.data,questions:questions.data});
}
