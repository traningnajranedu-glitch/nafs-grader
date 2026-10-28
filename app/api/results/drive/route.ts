import {NextRequest,NextResponse} from 'next/server';
import {driveToken,requireAdmin} from '../../../../lib/google-drive-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const FOLDERS=[{stage:'primary3',id:'16hQnpG5q1sBlO03Qj3X0MkNogwSQ-fXR'},{stage:'middle3',id:'1vT8Ms0smuINSgn6KXuCJhEZma5VRvdbn'},{stage:'primary6',id:'1foYgnj5csR6hrrRAkI8on6iZkXv3YMe6'}] as const;
type DriveFile={id:string;name:string;mimeType:string;modifiedTime?:string;webViewLink?:string;size?:string};
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const token=await driveToken();
  const stages=await Promise.all(FOLDERS.map(async folder=>{
   const files:DriveFile[]=[];let pageToken:string|undefined;
   do{
    const params=new URLSearchParams({q:"'"+folder.id+"' in parents and trashed = false",fields:'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,size)',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
    if(pageToken)params.set('pageToken',pageToken);
    const response=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if(!response.ok){const failure=await response.json().catch(()=>({}));throw Error('تعذر قراءة مجلد '+folder.stage+' (HTTP '+response.status+'): '+String(failure.error?.message||'تحقق من صلاحية حساب Google للمجلد'))}
    const body=await response.json();files.push(...(body.files||[]));pageToken=body.nextPageToken;
   }while(pageToken&&files.length<1000);
   const excel=files.filter(f=>(/\.xlsx?$/i.test(f.name)||f.mimeType==='application/vnd.google-apps.spreadsheet')&&(folder.stage!=='primary6'||(!/ملخص|تقرير|احصائ|إحصائ|مؤشر|قالب|نموذج|جديدين/i.test(f.name))));
   return {stage:folder.stage,folderItems:files.length,sampleTypes:[...new Set(files.map(f=>f.mimeType))].slice(0,5),emptyReason:files.length===0?'لم يُرجع Google Drive أي عناصر. تحقق من الحساب وصلاحيات المجلد.':excel.length===0?'عناصر موجودة ولكن لا توجد ملفات نتائج Excel مطابقة.':null,folderUrl:'https://drive.google.com/drive/folders/'+folder.id,count:excel.length,lastModified:excel.map(f=>f.modifiedTime||'').sort().at(-1)||null,files:excel.map(f=>({id:f.id,name:f.name,modifiedTime:f.modifiedTime||null,url:f.webViewLink||'https://drive.google.com/file/d/'+f.id+'/view'}))};
  }));
  return NextResponse.json({stages,checkedAt:new Date().toISOString(),source:'Google Drive file metadata; not verified sheet scores'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر مزامنة قائمة النتائج'},{status:403})}
}
