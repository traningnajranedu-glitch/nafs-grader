import {normalize,type SheetMeta} from './auto-omr';
type School={id:string;name:string;gender:string;stage:string};
export function matchSchool(meta:Pick<SheetMeta,'school'|'gender'|'stage'>,schools:School[]){const matches=schools.filter(s=>normalize(s.name)===normalize(meta.school)&&(!meta.gender||s.gender===meta.gender)&&(!meta.stage||s.stage===meta.stage));return matches.length===1?matches[0]:null}
export async function oldIdentity(canvas:HTMLCanvasElement,text:string,schools:School[],ocr:any){
 let code='';
 try{const {BrowserMultiFormatReader}=await import('@zxing/browser');code=new BrowserMultiFormatReader().decodeFromCanvas(canvas).getText();if(!/^[A-Za-z0-9-]{1,40}$/.test(code))code=''}catch{}
 let confidence=100;
 if(!text.trim()){
  if(!ocr)throw Error('محرك قراءة النص غير متاح');
  const crop=document.createElement('canvas');
  crop.width=canvas.width;crop.height=Math.round(canvas.height*.38);
  crop.getContext('2d')!.drawImage(canvas,0,0,canvas.width,canvas.height*.38,0,0,crop.width,crop.height);
  const r=await ocr.recognize(crop);text=r.data.text||'';confidence=r.data.confidence||0;crop.width=0;crop.height=0;
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
 const clean=(v:string)=>v.split(/(?:السجل المدني|رقم الطالب|المرحلة|الجنس|الصف|اسم المدرسة)\s*[:：]/)[0].trim();
 const school=matched?.name||clean(extract(['اسم المدرسة','المدرسة','مدرسة']));
 const name=clean(extract(['اسم الطالب','اسم الطالبة','الطالب','الطالبة']));
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