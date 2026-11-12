import {serviceDb} from './google-drive-server';
export const stageLabels:Record<string,string>={primary3:'ثالث ابتدائي',primary6:'سادس ابتدائي',middle3:'ثالث متوسط'};
export const subjectLabels:Record<string,string>={arabic:'اللغة العربية',math:'الرياضيات',science:'العلوم'};
export type ResultRow={id:string;import_id:string;student_name:string|null;civil_id:string|null;school_name:string|null;stage:string;gender:string|null;score:number|null;total:number|null;answers:any;status:string};


export function mathSupplement(row:ResultRow){
 if(row.stage!=='primary3')return null;
 const approval=row.answers?.primary3MathApproval;
 const source=row.answers?.primary3MathSupplement;
 if(!approval||!['complete','baseline_review'].includes(approval.status)||approval.supplementTotal!==10||source?.status!=='scored'||source.sourceSha256!==row.answers.sourceSha256||String(source.sourcePage)!==String(row.answers.sourcePage)||!row.answers.sourcePdfId||!/^[a-f0-9]{64}$/.test(row.answers.sourceSha256??'')||!Array.isArray(source.questions))return null;
 const questions=source.questions;
 if(questions.length!==10||new Set(questions.map((q:any)=>q?.number)).size!==10||!questions.every((q:any)=>Number.isInteger(q?.number)&&q.number>=11&&q.number<=20&&(q.awarded===0||q.awarded===1)))return null;
 const score=questions.reduce((sum:number,q:any)=>sum+q.awarded,0);
 if(approval.supplementScore!==score)return null;
 const combined=approval.status==='complete'&&row.status==='verified'&&row.total===20&&approval.mathTotal===20&&approval.overallTotal===30&&Number.isInteger(approval.mathScore)&&approval.mathScore>=score&&approval.mathScore<=score+10&&Number.isInteger(row.score)&&approval.overallScore===Number(row.score)+score;
 return {score,questions,combined,mathScore:combined?approval.mathScore as number:null,overallScore:combined?approval.overallScore as number:null};
}

export function displayedTotal(row:ResultRow){
 const m=mathSupplement(row);
 return m?.combined?{score:m.overallScore,total:30}:row.status==='verified'?{score:row.score,total:row.total}:{score:null,total:null};
}

function visibleRows(query:any,stage:string){
 return stage==='primary3'?query.or('status.eq.verified,answers->primary3MathApproval->>status.in.(complete,baseline_review)'):query.eq('status','verified');
}

export async function latestVerifiedRows(stage:string,school?:string,gender?:string){
 if(!stageLabels[stage])throw Error('مرحلة دراسية غير صالحة');
 const db=serviceDb();
 const imports:any[]=[];
 let from=0;
 while(true){
  const {data,error}=await db.from('nafs_result_imports')
   .select('id,drive_file_id,stage,school_name,modified_time,imported_at')
   .eq('stage',stage)
   .order('modified_time',{ascending:false,nullsFirst:false})
   .order('imported_at',{ascending:false})
   .range(from,from+999);
  if(error)throw error;
  if(!data?.length)break;
  imports.push(...data);
  from+=data.length;
  if(data.length<1000)break;
 }
 const latest=new Map<string,any>();
 for(const item of imports){
  const key=item.drive_file_id||item.id;
  if(!latest.has(key))latest.set(key,item);
 }
 const ids=[...latest.values()].map(x=>x.id);
 if(!ids.length)return [];

 // Keep each PostgREST IN filter small; a stage may contain hundreds of imports.
 const rows:ResultRow[]=[];
 const batchSize=100;
 for(let i=0;i<ids.length;i+=batchSize){
  const batch=ids.slice(i,i+batchSize);
  let rowOffset=0;
  while(true){
   const {data,error}=await visibleRows(db.from('nafs_result_import_rows')
    .select('id,import_id,student_name,civil_id,school_name,stage,gender,score,total,answers,status')
    .in('import_id',batch),stage)
    .order('row_number',{ascending:true}).order('id',{ascending:true})
    .range(rowOffset,rowOffset+999);
   if(error)throw error;
   if(!data?.length)break;
   rows.push(...(data as ResultRow[]).filter(row=>row.status==='verified'||mathSupplement(row)!==null));
   rowOffset+=data.length;
   if(data.length<1000)break;
  }
 }
 const norm=(v:string|null|undefined)=>(v||'').replace(/\.xlsx?$/i,'').replace(/[أإآ]/g,'ا').replace(/\s+/g,' ').trim();
 return rows.filter(r=>(!school||norm(r.school_name)===norm(school))&&(!gender||r.gender===gender));
}
export function questionRecords(row:ResultRow){
 const snapshot=row.answers?.excelSnapshot;
 const existing=row.status==='verified'?(Array.isArray(snapshot?.questions)?snapshot.questions:Array.isArray(row.answers?.questions)?row.answers.questions:[]):[];
 const supplement=mathSupplement(row);
 const list=supplement?[...existing.filter((q:any)=>q?.subject!=='math'||Number(q.number)<11||Number(q.number)>20),...supplement.questions.map((q:any)=>({...q,subject:'math'}))]:existing;
 return list.filter((q:any)=>q&&typeof q==='object'&&subjectLabels[q.subject]).map((q:any)=>({
  subject:q.subject,subjectLabel:subjectLabels[q.subject],number:Number(q.number)||0,
  choice:q.choice??null,correct:q.key??q.correct_answer??null,state:q.state??null,
  awarded:typeof q.awarded==='number'?q.awarded:null,
  correctness:typeof q.awarded==='number'?(q.awarded>0?'صحيحة':q.state==='multiple'?'تظليل متعدد':q.choice==null?'غير مجابة':'غير صحيحة'):'غير محدد',
  skillCode:q.skill_code??q.skillCode??null,skillName:q.skill_name??q.skillName??q.skill??q.competency??null
 })).filter((q:any)=>q.number>0);
}
export function subjectTotals(row:ResultRow){
 const raw=row.answers?.subjects&&typeof row.answers.subjects==='object'?row.answers.subjects:{};
 const columns=row.answers?.excelSnapshot?.columns||{};
 const aliases:Record<string,string[]>={arabic:['arabic','لغتي من 10','اللغة العربية من 10','العربية'],math:['math','الرياضيات من 10','رياضيات من 10'],science:['science','العلوم من 10','علوم من 10']};
 const m=mathSupplement(row);
 return Object.entries(subjectLabels).map(([key,label])=>{
  if(key==='math'&&m?.combined)return {key,label,value:m.mathScore!,max:20};
  if(row.status!=='verified')return {key,label,value:'',max:10};
  let value=raw[key];
  if(value===undefined||value===null){
   const found=(aliases[key]||[]).find(k=>columns[k]!==undefined&&columns[k]!==null&&columns[k]!=='');
   if(found)value=columns[found];
  }
  return {key,label,value:value===undefined||value===null?'':Number(value),max:10};
 });
}


/** Stream verified rows in bounded database pages for large exports. */
export async function* iterateLatestVerifiedRows(stage:string):AsyncGenerator<ResultRow>{
 if(!stageLabels[stage])throw Error('مرحلة دراسية غير صالحة');
 const db=serviceDb();
 const latest=new Map<string,any>();
 let from=0;
 while(true){
  const {data,error}=await db.from('nafs_result_imports')
   .select('id,drive_file_id,stage,modified_time,imported_at')
   .eq('stage',stage)
   .order('modified_time',{ascending:false,nullsFirst:false})
   .order('imported_at',{ascending:false})
   .range(from,from+999);
  if(error)throw error;
  if(!data?.length)break;
  for(const item of data){
   const key=item.drive_file_id||item.id;
   if(!latest.has(key))latest.set(key,item);
  }
  from+=data.length;
  if(data.length<1000)break;
 }
 const ids=[...latest.values()].map(x=>x.id);
 for(let i=0;i<ids.length;i+=100){
  const batch=ids.slice(i,i+100);
  let offset=0;
  while(true){
   const {data,error}=await visibleRows(db.from('nafs_result_import_rows')
    .select('id,import_id,student_name,civil_id,school_name,stage,gender,score,total,answers,status')
    .in('import_id',batch),stage)
    .order('row_number',{ascending:true}).order('id',{ascending:true})
    .range(offset,offset+499);
   if(error)throw error;
   if(!data?.length)break;
   for(const row of data as ResultRow[])if(row.status==='verified'||mathSupplement(row)!==null)yield row;
   offset+=data.length;
   if(data.length<500)break;
  }
 }
}
