import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '../../../../lib/google-drive-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));const db=serviceDb();
  const [imports,skills]=await Promise.all([
   db.from('nafs_result_imports').select('id,stage,school_name,row_count,status,modified_time,imported_at').order('imported_at',{ascending:false}).limit(1000),
   db.from('nafs_question_skills').select('stage,gender,subject,question_number,skill_code,skill_name,correct_answer').limit(1000)
  ]);
  if(imports.error)throw imports.error;if(skills.error)throw skills.error;
  const rows=imports.data||[];
  return NextResponse.json({imports:rows,skillMapCount:skills.data?.length||0,pending:rows.filter(x=>x.status==='pending_review').reduce((n,x)=>n+x.row_count,0),validated:rows.filter(x=>x.status==='validated').reduce((n,x)=>n+x.row_count,0),questionAnalyticsReady:false,note:'لا تعرض مؤشرات الأسئلة والمهارات حتى وجود إجابات مفصلة موثقة ونماذج إجابة معتمدة'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'غير متاح'},{status:403})}
}