import {NextRequest,NextResponse} from 'next/server';
import * as XLSX from 'xlsx';
import catalog from '../../../../../data/nafs-school-result-files-20261029.json';
import {requireAdmin} from '../../../../../lib/google-drive-server';
export const runtime='nodejs';
const stages:Record<string,string>={primary3:'ثالث ابتدائي',middle3:'ثالث متوسط',primary6:'سادس ابتدائي'};
function gender(s:string){return /بنات|بنت|للبنات|اناث|إناث/.test(s)?'بنات':/بنين|للبنين|ذكور/.test(s)?'بنين':'غير محدد';}
function school(s:string){return s.replace(/\.xlsx?$/i,'').replace(/^نتائج[-_ ]*/,'').trim();}
const excluded=/ملخص|تقرير|احصائ|إحصائ|مؤشر|قالب|نموذج|جديدين/;
export async function GET(req:NextRequest){
 try{
  await requireAdmin(req.headers.get('authorization'));
  const rows=catalog.files.filter(f=>!excluded.test(f.name)).map(f=>({
   'اسم المدرسة':school(f.name),'المرحلة':stages[f.stage]||f.stage,'الجنس':gender(f.name),
   'رابط ملف النتائج الاكسل للتنزيل':f.url||'https://drive.google.com/file/d/'+f.id+'/view',
   'معرف الملف':f.id,'اسم الملف الأصلي':f.name
  }));
  const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:43},{wch:20},{wch:16},{wch:80},{wch:38},{wch:55}];
  ws['!autofilter']={ref:'A1:F'+(rows.length+1)};
  XLSX.utils.book_append_sheet(wb,ws,'فهرس المدارس');
  const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
  return new NextResponse(buffer,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':"attachment; filename=nafs-483-school-results.xlsx",'Cache-Control':'private, no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'تعذر إنشاء الفهرس'},{status:403})}
}
