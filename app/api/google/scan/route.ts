import {NextRequest,NextResponse} from 'next/server';
import {driveToken,requireAdmin,serviceDb} from '../../../../lib/google-drive-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type DriveFile={id:string;name:string;mimeType:string;modifiedTime?:string};
export async function POST(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const folder=process.env.GOOGLE_DRIVE_INPUT_FOLDER_ID;
  if(!folder)throw Error('لم يتم ضبط مجلد استقبال ملفات PDF');
  const token=await driveToken();
  const found:DriveFile[]=[];let pageToken:string|undefined;
  do{
   const query=new URLSearchParams({q:"'"+folder.replace(/'/g,"\\'")+"' in parents and mimeType = 'application/pdf' and trashed = false",fields:'nextPageToken,files(id,name,mimeType,modifiedTime)',pageSize:'100'});
   if(pageToken)query.set('pageToken',pageToken);
   const res=await fetch('https://www.googleapis.com/drive/v3/files?'+query.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   const body=await res.json();if(!res.ok)throw Error(body.error?.message||'تعذر قراءة مجلد Google Drive');
   found.push(...(body.files||[]));pageToken=body.nextPageToken;
  }while(pageToken&&found.length<1000);
  const db=serviceDb();let inserted=0;let existing=0;
  for(const file of found){
   const {data,error}=await db.from('nafs_drive_pdf_queue').upsert({file_id:file.id,file_name:file.name,mime_type:file.mimeType,modified_time:file.modifiedTime||null},{onConflict:'file_id',ignoreDuplicates:true}).select('file_id');
   if(error)throw error;if(data?.length)inserted++;else existing++;
  }
  const {data:queue,error}=await db.from('nafs_drive_pdf_queue').select('file_id,file_name,state,error_message,created_at').order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  return NextResponse.json({success:true,found:found.length,inserted,existing,queue});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر فحص الملفات'},{status:403})}
}
export async function GET(req:NextRequest){
 try{await requireAdmin(req.headers.get('authorization'));const {data,error}=await serviceDb().from('nafs_drive_pdf_queue').select('file_id,file_name,state,error_message,created_at').order('created_at',{ascending:false}).limit(100);if(error)throw error;return NextResponse.json({queue:data})}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر تحميل القائمة'},{status:403})}
}