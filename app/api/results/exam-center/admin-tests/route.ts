import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,serviceDb} from "../../../../../lib/google-drive-server";
export const runtime="nodejs";
export async function GET(req:NextRequest){try{await requireAdmin(req.headers.get("authorization"));const db=serviceDb();const r=await db.from("nafs_exam_teacher_tests").select("id,title,status,subject,teacher_id").eq("status","published").order("created_at",{ascending:false});if(r.error)throw Error(r.error.message);return NextResponse.json({tests:r.data||[]});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"غير مصرح"},{status:403})}}
