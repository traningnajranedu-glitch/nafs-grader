import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,driveToken} from '../../../../lib/google-drive-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const id=req.nextUrl.searchParams.get('id')||'';
  if(!/^[a-zA-Z0-9_-]{10,128}$/.test(id))return NextResponse.json({error:'معرف ملف غير صالح'},{status:400});
  const token=await driveToken(),folder=process.env.GOOGLE_DRIVE_INPUT_FOLDER_ID;
  if(!folder)throw Error('مجلد الاستقبال غير مضبوط');
  const metaRes=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,parents,size,trashed',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const meta=await metaRes.json();
  if(!metaRes.ok||meta.trashed||meta.mimeType!=='application/pdf'||!Array.isArray(meta.parents)||!meta.parents.includes(folder))return NextResponse.json({error:'الملف ليس PDF في مجلد الاستقبال المعتمد'},{status:403});
  if(Number(meta.size)>25000000)return NextResponse.json({error:'الملف أكبر من الحد المسموح 25 ميجابايت'},{status:413});
  const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!response.ok||!response.body)throw Error('تعذر تنزيل PDF من Google Drive');
  return new NextResponse(response.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(meta.name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر فتح PDF'},{status:403})}
}