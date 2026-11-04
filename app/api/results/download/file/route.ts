import {NextRequest,NextResponse} from 'next/server';
import {driveToken,requireAdmin} from '../../../../../lib/google-drive-server';
import catalog from '../../../../../data/nafs-school-result-files-20261029.json';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const allowedFolders=new Set(['16hQnpG5q1sBlO03Qj3X0MkNogwSQ-fXR','1vT8Ms0smuINSgn6KXuCJhEZma5VRvdbn']);
const allowedSixthFiles=new Set(catalog.files.filter(f=>f.stage==='primary6').map(f=>f.id));
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const id=req.nextUrl.searchParams.get('fileId')||'';
  if(!/^[a-zA-Z0-9_-]{10,150}$/.test(id))return NextResponse.json({error:'معرف ملف غير صالح'},{status:400});
  const token=await driveToken();
  const headers={Authorization:'Bearer '+token};
  const metadata=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,parents,trashed&supportsAllDrives=true',{headers,cache:'no-store'});
  if(!metadata.ok)return NextResponse.json({error:'لم يتم العثور على الملف في Google Drive؛ تحقق من صلاحية الملف أو تحديث الفهرس'},{status:404});
  const file=await metadata.json();
  const isSheet=file.mimeType==='application/vnd.google-apps.spreadsheet';
  const isExcel=/\.xlsx?$/i.test(file.name||'');
  const isInLiveFolder=Array.isArray(file.parents)&&file.parents.some((p:string)=>allowedFolders.has(p));
  const isCataloguedSixth=allowedSixthFiles.has(id);
  if(file.trashed||(!isInLiveFolder&&!isCataloguedSixth)||(!isSheet&&!isExcel))return NextResponse.json({error:'هذا الملف غير مدرج ضمن ملفات النتائج المصرح بتنزيلها'},{status:403});
  const endpoint='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id);
  const url=isSheet?endpoint+'/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet':endpoint+'?alt=media&supportsAllDrives=true';
  const response=await fetch(url,{headers,cache:'no-store'});
  if(!response.ok||!response.body){const detail=await response.text().catch(()=> '');return NextResponse.json({error:'تعذر تنزيل ملف Excel من Google Drive'+(detail?': '+detail.slice(0,250):'')},{status:502});}
  const filename=String(file.name).replace(/[\r\n"\\]/g,'_').replace(/\.xlsx$/i,'')+'.xlsx';
  return new NextResponse(response.body,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر التنزيل'},{status:403})}
}
