import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,serviceDb,driveToken} from '../../../../lib/google-drive-server';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const db=serviceDb(),row=await db.from('nafs_google_drive_connection').select('updated_at').eq('id',1).maybeSingle();
  if(row.error)throw row.error;
  if(!row.data)return NextResponse.json({connected:false});
  const token=await driveToken(),id=process.env.GOOGLE_DRIVE_INPUT_FOLDER_ID;
  if(!id)return NextResponse.json({connected:true,folderAccess:false,error:'لم يتم ضبط مجلد استقبال ملفات PDF'});
  const res=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,trashed',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const folder=await res.json();
  const accessible=res.ok&&!folder.trashed&&folder.mimeType==='application/vnd.google-apps.folder';
  return NextResponse.json({connected:true,folderAccess:accessible,folderUrl:accessible?'https://drive.google.com/drive/folders/'+encodeURIComponent(id):undefined,folderName:accessible?folder.name:undefined,error:accessible?null:'تعذر الوصول إلى مجلد الاستقبال المعتمد'});
 }catch(e){return NextResponse.json({connected:false,error:e instanceof Error?e.message:'تعذر فحص الاتصال'},{status:403})}
}
