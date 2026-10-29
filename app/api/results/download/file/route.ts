import {NextRequest,NextResponse} from 'next/server';
import {driveToken,requireAdmin} from '../../../../../lib/google-drive-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const allowedFolders=new Set(['16hQnpG5q1sBlO03Qj3X0MkNogwSQ-fXR','1vT8Ms0smuINSgn6KXuCJhEZma5VRvdbn','1foYgnj5csR6hrrRAkI8on6iZkXv3YMe6']);
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const id=req.nextUrl.searchParams.get('fileId')||'';
  if(!/^[a-zA-Z0-9_-]{10,150}$/.test(id))return NextResponse.json({error:'معرف ملف غير صالح'},{status:400});
  const token=await driveToken();
  const headers={Authorization:'Bearer '+token};
  const metadata=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,parents,trashed&supportsAllDrives=true',{headers,cache:'no-store'});
  if(!metadata.ok)return NextResponse.json({error:'لم يتم العثور على الملف'},{status:404});
  const file=await metadata.json();
  const isSheet=file.mimeType==='application/vnd.google-apps.spreadsheet';
  if(file.trashed||!file.parents?.some((p:string)=>allowedFolders.has(p))||(!isSheet&&!/\.xlsx$/i.test(file.name)))return NextResponse.json({error:'هذا الملف غير مسموح بتنزيله'},{status:403});
  const endpoint='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id);
  const url=isSheet?endpoint+'/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet':endpoint+'?alt=media&supportsAllDrives=true';
  const response=await fetch(url,{headers,cache:'no-store'});
  if(!response.ok||!response.body)return NextResponse.json({error:'تعذر قراءة ملف Excel من Google Drive'},{status:502});
  const filename=String(file.name).replace(/[\r\n"\\]/g,'_').replace(/\.xlsx$/i,'')+'.xlsx';
  return new NextResponse(response.body,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر التنزيل'},{status:403})}
}
