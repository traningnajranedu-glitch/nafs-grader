// An unchanged result may retain its documented approval across Excel versions.
// A status label in Excel never creates a new approval.
export type QuestionEvidence={subject:string;number:number;key:string;choice:string|null;state:string;awarded:number;studentName?:string};
export type ImportRecord={row_number:number;student_name:string|null;civil_id:string|null;stage:string;gender:string|null;score:number|null;total:number|null;status:string;answers:Record<string,unknown>};
export type SourceEvidence={pdfId:string;sha256:string};
// Import source evidence for every row. Only retainedApproval may carry an
// existing approval; workbook metadata and status text never grant approval.
export function importedEvidence(answers:Record<string,unknown>,questions:QuestionEvidence[],source:SourceEvidence|null):Record<string,unknown>{
 return {...answers,...(source?{sourcePdfId:source.pdfId,sourceSha256:source.sha256}:{}),
  ...(questions.length?{questions:questions.map(({studentName,...q})=>({...q,awarded:Number.isFinite(q.awarded)?q.awarded:null})),evidenceVerification:'imported-unverified'}:{})};
}
const states:Record<string,string>={'تظليل واحد واضح':'clear','تظليل متعدد':'multiple','تظليل متعدد - خطأ':'multiple','دون تظليل':'blank','فارغ':'blank','فارغ - خطأ':'blank','تظليل خفيف':'faint','تظليل خفيف جدًا':'faint','تظليل خفيف جدًا - خطأ':'faint'};
const subjects:Record<string,string>={'لغتي':'arabic','الرياضيات':'math','رياضيات':'math','العلوم':'science','علوم':'science'};
export function readQuestionEvidence(matrix:unknown[][]){
 const pages=new Map<number,QuestionEvidence[]>();
 for(const r of matrix){const page=Number(r[0]),number=Number(r[3]),subject=subjects[String(r[2]??'')],state=states[String(r[6]??'').trim()];if(!Number.isInteger(page)||page<1||!subject)continue;
  const q={subject,number,key:String(r[5]??'').trim(),choice:r[4]===null||r[4]===undefined||r[4]===''?null:String(r[4]).trim(),state:state||'uncertain',awarded:r[7]===null||r[7]===undefined||r[7]===''?NaN:Number(r[7]),studentName:String(r[1]??'').trim()};pages.set(page,[...(pages.get(page)||[]),q]);
 }return pages;
}
export function readSourceEvidence(matrix:unknown[][]):SourceEvidence|null{
 const fields=new Map(matrix.map(r=>[String(r[0]??'').trim(),String(r[1]??'').trim()]));const sha256=fields.get('بصمة PDF SHA256')||'',pdfId=(fields.get('ملف المصدر')||'').match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1];return pdfId&&/^[a-f0-9]{64}$/.test(sha256)?{pdfId,sha256}:null;
}
export function retainedApproval(previous:ImportRecord,incoming:ImportRecord,questions:QuestionEvidence[],source:SourceEvidence|null,keys:Map<string,string>,fileId:string):Record<string,unknown>|null{
 const expected=incoming.stage==='primary3'?20:incoming.stage==='middle3'?30:0;
 if(!expected||previous.status!=='verified'||!source||!incoming.student_name||!incoming.civil_id||!['بنين','بنات'].includes(incoming.gender||'')||incoming.score===null||incoming.total!==expected||incoming.answers.reviewReason||/تحتاج مراجعة|تحت التدقيق/.test(String(incoming.answers.sourceStatus||'')))return null;
 if(previous.student_name!==incoming.student_name||previous.civil_id!==incoming.civil_id||previous.gender!==incoming.gender||previous.stage!==incoming.stage||previous.score!==incoming.score||previous.total!==incoming.total)return null;
 const a=previous.answers,old=a.questions;
 if(a.sourceFileId!==fileId||a.sourcePdfId!==source.pdfId||a.sourceSha256!==source.sha256||Number(a.sourcePage)!==Number(incoming.answers.sourcePage)||!Array.isArray(old)||old.length!==expected||questions.length!==expected)return null;
 const oldBy=new Map(old.map(q=>[q.subject+':'+q.number,q]));const seen=new Set<string>();let sum=0;
 for(const q of questions){const key=q.subject+':'+q.number,p=oldBy.get(key);if(seen.has(key)||!p||q.studentName!==incoming.student_name||!Number.isInteger(q.number)||q.number<1||q.number>10||!['arabic','math',...(expected===30?['science']:[])].includes(q.subject)||!['clear','multiple','blank','faint'].includes(q.state)||!/^[ABCD]$/.test(q.key)||keys.get(key)!==q.key)return null;
  if(q.state==='clear'?!q.choice||!/^[ABCD]$/.test(q.choice):q.choice!==null)return null;
  const awarded=Number(q.state==='clear'&&q.choice===q.key);if(q.awarded!==awarded||p.key!==q.key||p.choice!==q.choice||p.state!==q.state||p.awarded!==q.awarded)return null;seen.add(key);sum+=awarded;
 }
 if(sum!==incoming.score||seen.size!==expected)return null;
 return {...a,excelSnapshot:incoming.answers.excelSnapshot||a.excelSnapshot,sourceStatus:incoming.answers.sourceStatus,reviewReason:'',sourceRow:incoming.row_number,auditHistory:[...(Array.isArray(a.auditHistory)?a.auditHistory:[]),{date:new Date().toISOString(),method:'retained-approval-identical-current-excel-identity-source-and-questions',gradesPreserved:true}]};
}
