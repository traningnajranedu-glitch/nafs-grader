import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,driveToken} from '../../../../lib/google-drive-server';
export const runtime='nodejs';
// Scan, download and this link must always use the same configured folder.
export async function POST(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const id=process.env.GOOGLE_DRIVE_INPUT_FOLDER_ID;
  if(!id)throw Error('لم يتم ضبط مجلد استقبال ملفات PDF');
  const token=await driveToken();
  const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,trashed',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const folder=await response.json();
  if(!response.ok||folder.trashed||folder.mimeType!=='application/vnd.google-apps.folder')throw Error('تعذر الوصول إلى مجلد الاستقبال المعتمد؛ تحقق من ربط حساب Google وصلاحية المجلد');
  return NextResponse.json({success:true,folderId:id,name:folder.name,url:'https://drive.google.com/drive/folders/'+encodeURIComponent(id)});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر فتح المجلد'},{status:403})}
}
