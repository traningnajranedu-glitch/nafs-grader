import {normalize,type SheetMeta} from './auto-omr';
type School={id:string;name:string;gender:string;stage:string};
function schoolKey(value:string){return normalize(value).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/^(?:مدرسه|مدرسة)\s*/,'').replace(/\s*(?:نسخة|copy)\s*\(?\d+\)?$/i,'').replace(/\s*\(?\d+\)?$/,'').replace(/\s+/g,' ').trim()}
function schoolVariants(value:string){const key=schoolKey(value);if(!key)return [];const variants=[key];const withoutRoyal=key.replace(/^(ابتدائيه|ابتدائي|متوسطه|متوسط|ثانويه|ثانوي)\s+الملك\s+/,'$1 ');if(withoutRoyal!==key)variants.push(withoutRoyal);return variants}
export function matchSchool(meta:Pick<SheetMeta,'school'|'gender'|'stage'>,schools:School[]){const key=schoolKey(meta.school||'');if(!key)return null;const exact=schools.filter(s=>schoolKey(s.name)===key);const matches=exact.length?exact:schools.filter(s=>schoolVariants(s.name).includes(key));if(matches.length!==1)return null;const candidate=matches[0];const gender=(v:string)=>/بنات|اناث|إناث|طالبات/.test(v)?'بنات':/بنين|ذكور|طلاب/.test(v)?'بنين':'';const stage=(v:string)=>/ابتدائ/.test(v)?'ابتدائي':/متوسط/.test(v)?'متوسط':/ثانو/.test(v)?'ثانوي':/طفولة/.test(v)?'طفولة مبكرة':'';if(meta.gender&&gender(meta.gender)&&gender(candidate.gender)&&gender(meta.gender)!==gender(candidate.gender))return null;if(meta.stage&&stage(meta.stage)&&stage(candidate.stage)&&stage(meta.stage)!==stage(candidate.stage))return null;return candidate}
export async function oldIdentity(canvas:HTMLCanvasElement,text:string,schools:School[],ocr:any){
 let code='';
 try{const {BrowserMultiFormatReader}=await import('@zxing/browser');code=new BrowserMultiFormatReader().decodeFromCanvas(canvas).getText();if(!/^[A-Za-z0-9-]{1,40}$/.test(code))code=''}catch{}
 let confidence=100;
 if(!text.trim()){
  if(!ocr)throw Error('محرك قراءة النص غير متاح');
  const crop=document.createElement('canvas');
  const sourceHeight=Math.round(canvas.height*.48);
  const scale=canvas.width<1800?Math.min(2.3,1800/canvas.width):1;
  crop.width=Math.round(canvas.width*scale);crop.height=Math.round(sourceHeight*scale);
  const ctx=crop.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(canvas,0,0,canvas.width,sourceHeight,0,0,crop.width,crop.height);
  const r=await ocr.recognize(crop);text=r.data.text||'';confidence=r.data.confidence||0;
  if(!/(?:اسم\s*الطالب|اسم\s*الطالبة)/.test(text)||!/(?:اسم\s*المدرسة|المدرسة)/.test(text)){
   const contrast=ctx.getImageData(0,0,crop.width,crop.height);
   for(let i=0;i<contrast.data.length;i+=4){const lum=.299*contrast.data[i]+.587*contrast.data[i+1]+.114*contrast.data[i+2];const val=lum>175?255:lum<110?0:Math.round((lum-110)*255/65);contrast.data[i]=val;contrast.data[i+1]=val;contrast.data[i+2]=val;}
   ctx.putImageData(contrast,0,0);
   const enhanced=await ocr.recognize(crop);if((enhanced.data.text||'').trim())text+='\n'+enhanced.data.text;
  }
  crop.width=0;crop.height=0;
 }
 text=text.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'');
 const norm=normalize(text),found=schools.filter(s=>norm.includes(normalize(s.name)));
 const matched=found.length===1?found[0]:null;
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 function extract(labels:string[]){
  for(const line of lines)for(const label of labels){
   const index=line.indexOf(label);
   if(index<0)continue;
   const value=line.slice(index+label.length).replace(/^[\s:：\-|]+/,'').trim();
   if(value)return value;
  }
  return '';
 }
 // Keep OCR fields separate: a label's value may appear on the following line in RTL scans.
 const labels=/(?:اسم\s*المدرسة|المدرسة|اسم\s*الطالب(?:ة)?|السجل\s*المدني|رقم\s*الهوية|رقم\s*الطالب|الجنس|المرحلة|الصف)/g;
 const tidy=(v:string)=>v.replace(/[\u064B-\u065F\u0670]/g,'').replace(/\s+/g,' ').replace(/^[\s:：\-|،]+|[\s:：\-|،]+$/g,'').trim();
 const isolate=(v:string)=>tidy(v.split(labels)[0]);
 const garbage=/(?:التظليل|الصحيح|غير\s*مقروء|ورقة|الاختبار|الإجابة|الإجابات|السؤال|تعليمات|وزارة|التعليم|نموذج|الدرجة|اسم\s*الطالب|السجل|الجنس|المرحلة|الصف)/;
 const isSchool=(v:string)=>{const s=tidy(v);return s.length>=5&&s.length<=115&&!/[A-Za-z@®©]/.test(s)&&!/التظليل|الصحيح|السؤال|الإجابة|الطالب|السجل/.test(s)&&/(?:مدرسة|ابتدائي|متوسط|ثانوي|مجمع)/.test(s)};
 const isPerson=(v:string)=>{const s=tidy(v);return s.length>=7&&s.length<=85&&!/[A-Za-z0-9٠-٩۰-۹@®©]/.test(s)&&!garbage.test(s)&&!isSchool(s)&&/^[\u0621-\u064A\s]+$/.test(s)&&s.split(/\s+/).length>=2};
 const afterLabel=(line:string,label:RegExp)=>{const m=line.match(label);return m?isolate(line.slice((m.index||0)+m[0].length)):''};
 const schoolCandidates:string[]=[];
 const personCandidates:string[]=[];
 for(let i=0;i<lines.length;i++){
  const line=tidy(lines[i]);
  const schoolValue=afterLabel(line,/(?:اسم\s*المدرسة|المدرسة)\s*[:：\-]?/);
  if(isSchool(schoolValue))schoolCandidates.push(schoolValue);
  if(isSchool(line))schoolCandidates.push(isolate(line));
  const nameValue=afterLabel(line,/(?:اسم\s*الطالب(?:ة)?|الطالب(?:ة)?)\s*[:：\-]?/);
  if(isPerson(nameValue))personCandidates.push(nameValue);
  // OCR often places the value on the next line; do not treat headings as names.
  if(/اسم\s*الطالب(?:ة)?/.test(line)&&i+1<lines.length&&isPerson(lines[i+1]))personCandidates.push(tidy(lines[i+1]));
  if(/اسم\s*الطالب(?:ة)?/.test(line)&&i>0&&isPerson(lines[i-1]))personCandidates.push(tidy(lines[i-1]));
 }
 const school=matched?.name||schoolCandidates[0]||'';
 // Never guess a student's name from a school name, printed instructions or an answer label.
 const name=personCandidates.find(v=>v!==school&&!schoolCandidates.includes(v))||'';
 if(!code){
  const raw=extract(['السجل المدني','رقم الهوية','رقم الطالب','السجل','الهوية']);
  code=(raw.match(/[0-9٠-٩۰-۹][0-9٠-٩۰-۹\s-]{5,19}/)?.[0]||text.match(/(?:^|\D)([0-9٠-٩۰-۹]{10})(?!\d)/m)?.[1]||'')
   .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632))
   .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[\s-]/g,'');
 }
 const genderText=extract(['الجنس','نوع الطلاب'])||text;
 const gender=/بنات|طالبات|أنثى|اناث/.test(genderText)?'بنات':/بنين|طلاب|ذكر|ذكور/.test(genderText)?'بنين':matched?.gender||'';
 const stageText=extract(['المرحلة الدراسية','المرحلة'])||text;
 const stage=/طفولة مبكرة/.test(stageText)?'طفولة مبكرة':/ابتدائي/.test(stageText)?'ابتدائي':/متوسط/.test(stageText)?'متوسط':/ثانوي/.test(stageText)?'ثانوي':matched?.stage||'';
 const grade=extract(['الصف الدراسي','الصف'])||text.match(/(?:الصف|—)\s*([1-9]|10)\b/)?.[1]||'';
 return {school,schoolId:matched?.id||'',name,code,gender,stage,grade,confidence};
}