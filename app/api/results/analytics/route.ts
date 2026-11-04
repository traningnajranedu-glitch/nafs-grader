import {NextRequest,NextResponse} from 'next/server';
import {serviceDb} from '../../../../lib/google-drive-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
type AnalyticsPart={schools:any[];questions:any[];subjects:any[];skills:any[];genders:any[];summary:any;stages:any[];checkedAt:string;thresholdNote:string;source:string};
const sum=(parts:AnalyticsPart[],key:string)=>parts.reduce((n,p)=>n+Number(p.summary?.[key]||0),0);
export async function GET(req:NextRequest){
 try{
  const p=req.nextUrl.searchParams;
  const stage=p.get('stage'),gender=p.get('gender'),subject=p.get('subject');
  if(stage&&!['primary3','middle3'].includes(stage)||gender&&!['بنين','بنات'].includes(gender)||subject&&!['arabic','math','science'].includes(subject))return NextResponse.json({error:'قيمة فلتر غير صالحة'},{status:400});
  const stages=stage?[stage]:['primary3','middle3'];
  const db=serviceDb();
  const parts:AnalyticsPart[]=await Promise.all(stages.map(async selectedStage=>{
   const {data,error}=await db.rpc('nafs_verified_analytics',{p_stage:selectedStage,p_gender:gender||null,p_school:p.get('school')||null,p_subject:subject||null,p_skill:p.get('skill')||null});
   if(error)throw error;
   if(!data||!data.summary)throw Error('Analytics unavailable');
   return data as AnalyticsPart;
  }));
  const schools=parts.flatMap(x=>x.schools||[]);
  const questions=parts.flatMap(x=>x.questions||[]);
  const subjects=parts.flatMap(x=>x.subjects||[]);
  const skills=parts.flatMap(x=>x.skills||[]);
  const included=sum(parts,'included'),students=sum(parts,'students'),verified=sum(parts,'verified');
  const gendersMap=new Map<string,{gender:string;students:number;weighted:number}>();
  for(const part of parts)for(const g of part.genders||[]){
   const current=gendersMap.get(g.gender)||{gender:g.gender,students:0,weighted:0};
   current.students+=Number(g.students||0);current.weighted+=Number(g.percent||0)*Number(g.students||0);
   gendersMap.set(g.gender,current);
  }
  const genders=[...gendersMap.values()].map(g=>({gender:g.gender,students:g.students,percent:g.students?g.weighted/g.students:0}));
  const skillMap=new Map<string,{code:string;name:string}>();
  for(const s of skills)if(s.skill_code&&s.skill_name)skillMap.set(s.skill_code,{code:s.skill_code,name:s.skill_name});
  const data={
   schools,questions,subjects,skills,genders,
   options:{schools:[...new Set(schools.map(s=>s.school))].sort((a,b)=>String(a).localeCompare(String(b),'ar')),skills:[...skillMap.values()]},
   summary:{students,verified,excluded:sum(parts,'excluded'),missing:sum(parts,'missing'),included,
    percent:included?parts.reduce((n,x)=>n+Number(x.summary.percent||0)*Number(x.summary.included||0),0)/included:null,
    coverage:students?100*verified/students:null,invalidVerified:sum(parts,'invalidVerified'),unmappedQuestions:sum(parts,'unmappedQuestions')},
   stages:parts.flatMap(x=>x.stages||[]),checkedAt:new Date().toISOString(),
   skillMapCount:skillMap.size,thresholdNote:parts[0]?.thresholdNote||'',
   source:'latest Excel versions / verified source evidence — third primary and third intermediate only'
  };
  return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('NAFS verified analytics error',e);return NextResponse.json({error:'تعذر تحميل مؤشرات النتائج المتحقق منها'},{status:500})}
}
