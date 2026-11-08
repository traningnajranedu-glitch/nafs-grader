import {serviceDb} from './google-drive-server';
export const stageLabels:Record<string,string>={primary3:'ثالث ابتدائي',primary6:'سادس ابتدائي',middle3:'ثالث متوسط'};
export const subjectLabels:Record<string,string>={arabic:'اللغة العربية',math:'الرياضيات',science:'العلوم'};
export type ResultRow={id:string;import_id:string;student_name:string|null;civil_id:string|null;school_name:string|null;stage:string;gender:string|null;score:number|null;total:number|null;answers:any;status:string};
export async function latestVerifiedRows(stage:string,school?:string,gender?:string){
 if(!stageLabels[stage])throw Error('مرحلة دراسية غير صالحة');
 const db=serviceDb();let imports:any[]=[];let from=0;
 while(true){const {data,error}=await db.from('nafs_result_imports').select('id,drive_file_id,stage,school_name,modified_time,imported_at').eq('stage',stage).order('modified_time',{ascending:false,nullsFirst:false}).order('imported_at',{ascending:false}).range(from,from+999);if(error)throw error;if(!data?.length)break;imports.push(...data);from+=data.length;if(data.length<1000)break;}
 const latest=new Map<string,any>();for(const item of imports){const key=item.drive_file_id||item.id;if(!latest.has(key))latest.set(key,item);}
 const ids=[...latest.values()].map(x=>x.id);if(!ids.length)return [];
 let rows:ResultRow[]=[];from=0;
 while(true){const {data,error}=await db.from('nafs_result_import_rows').select('id,import_id,student_name,civil_id,school_name,stage,gender,score,total,answers,status').in('import_id',ids).eq('status','verified').order('row_number',{ascending:true}).range(from,from+999);if(error)throw error;if(!data?.length)break;rows.push(...data as ResultRow[]);from+=data.length;if(data.length<1000)break;}
 const norm=(v:string|null|undefined)=>(v||'').replace(/\\.xlsx?$/i,'').replace(/[أإآ]/g,'ا').replace(/\\s+/g,' ').trim();
 return rows.filter(r=>(!school||norm(r.school_name)===norm(school))&&(!gender||r.gender===gender));
}
export function questionRecords(row:ResultRow){
 const snapshot=row.answers?.excelSnapshot;
 const list=Array.isArray(snapshot?.questions)?snapshot.questions:Array.isArray(row.answers?.questions)?row.answers.questions:[];
 return list.filter((q:any)=>q&&typeof q==='object'&&subjectLabels[q.subject]).map((q:any)=>({
  subject:q.subject,subjectLabel:subjectLabels[q.subject],number:Number(q.number)||0,
  choice:q.choice??null,correct:q.key??q.correct_answer??null,state:q.state??null,
  awarded:typeof q.awarded==='number'?q.awarded:null,
  correctness:typeof q.awarded==='number'?(q.awarded>0?'صحيحة':q.choice==null?'غير مجابة':'غير صحيحة'):'غير محدد',
  skillCode:q.skill_code??q.skillCode??null,skillName:q.skill_name??q.skillName??q.skill??q.competency??null
 })).filter((q:any)=>q.number>0);
}
export function subjectTotals(row:ResultRow){
 const raw=row.answers?.subjects&&typeof row.answers.subjects==='object'?row.answers.subjects:{};
 const columns=row.answers?.excelSnapshot?.columns||{};
 const aliases:Record<string,string[]>={arabic:['arabic','لغتي من 10','اللغة العربية من 10','العربية'],math:['math','الرياضيات من 10','رياضيات من 10'],science:['science','العلوم من 10','علوم من 10']};
 return Object.entries(subjectLabels).map(([key,label])=>{
  let value=raw[key];
  if(value===undefined||value===null){
   const found=(aliases[key]||[]).find(k=>columns[k]!==undefined&&columns[k]!==null&&columns[k]!=='');
   if(found)value=columns[found];
  }
  return {key,label,value:value===undefined||value===null?'':Number(value)};
 });
}
