import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export const maxDuration=60;
const subjects=['لغتي','الرياضيات','العلوم'] as const;
const schema={type:'object',additionalProperties:false,properties:{identity:{type:'object',additionalProperties:false,properties:{name:{type:['string','null']},code:{type:['string','null']},school:{type:['string','null']},gender:{type:['string','null']},stage:{type:['string','null']},grade:{type:['string','null']}},required:['name','code','school','gender','stage','grade']},subjects:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,properties:{name:{type:'string',enum:[...subjects]},answers:{type:'array',minItems:20,maxItems:20,items:{type:'object',additionalProperties:false,properties:{question:{type:'integer'},option:{type:['string','null'],enum:['A','B','C','D',null]},status:{type:'string',enum:['clear','blank','multiple','uncertain']}},required:['question','option','status']}}},required:['name','answers']}}},required:['identity','subjects']};
export async function POST(req:NextRequest){
 try{
  const key=process.env.OPENAI_API_KEY;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!key)return NextResponse.json({error:'مفتاح OpenAI غير مضبوط على الخادم'},{status:503});
  if(!url||!publicKey)return NextResponse.json({error:'إعدادات تسجيل الدخول غير مكتملة'},{status:503});
  const bearer=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!bearer)return NextResponse.json({error:'يلزم تسجيل الدخول'},{status:401});
  const db=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await db.auth.getUser(bearer);
  if(authError||!user)return NextResponse.json({error:'جلسة غير صالحة'},{status:401});
  const body=await req.json();
  const image=body?.image;
  if(typeof image!=='string'||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>9_000_000)return NextResponse.json({error:'صورة الورقة غير صالحة أو كبيرة جدًا'},{status:400});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),50000);
  let response:Response;
  try{response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_VISION_MODEL||'gpt-4.1',store:false,max_output_tokens:4500,input:[{role:'system',content:[{type:'input_text',text:'You are reading a Saudi NAFS scanned multiple-choice answer sheet. There are exactly three subject blocks from right to left: لغتي, الرياضيات, العلوم. Each block has 20 numbered rows. Arabic options from right to left are أ=A, ب=B, ج=C, د=D. Read the FILLED CIRCLE ONLY, not the printed character. Return one answer per question 1-20 in each subject, null for blank/multiple/uncertain. Do not guess. If ambiguous set uncertain. Never use an answer key. Also transcribe student identity exactly as printed: student full name, student/national ID, school name, gender, educational stage, and grade. Return null for any field not explicitly legible on the page. Do not infer gender from the name, stage from age, or grade from the test. For grade use the printed Arabic grade label when visible. Never invent personal details.'}]},{role:'user',content:[{type:'input_text',text:'Read the answer bubbles from this scanned sheet and output all 60 readings. Questions 11-20 may be blank. Verify orientation carefully. Extract printed student metadata, returning null when absent or unreadable.'},{type:'input_image',image_url:image,detail:'high'}]}],text:{format:{type:'json_schema',name:'nafs_bubble_reading',strict:true,schema}}})});}finally{clearTimeout(timeout)}
  if(!response.ok)return NextResponse.json({error:'تعذر الاتصال بمحرك الرؤية ('+response.status+')'},{status:502});
  const payload=await response.json();const output=(payload.output||[]).flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==='output_text')?.text;
  if(!output)return NextResponse.json({error:'لم يرجع نموذج الرؤية نتائج قابلة للقراءة'},{status:502});
  const parsed=JSON.parse(output);
  if(!Array.isArray(parsed.subjects)||parsed.subjects.length!==3||subjects.some(name=>!parsed.subjects.some((s:any)=>s.name===name&&Array.isArray(s.answers)&&s.answers.length===20&&s.answers.every((a:any,i:number)=>a.question===i+1&&['clear','blank','multiple','uncertain'].includes(a.status)&&(['A','B','C','D',null].includes(a.option))))))return NextResponse.json({error:'نتيجة الرؤية لا تطابق نموذج الستين سؤالًا'},{status:422});
  const identity=parsed.identity||{};const clean=(v:unknown)=>typeof v==='string'?v.trim().slice(0,160):null;const normalized={name:clean(identity.name),code:clean(identity.code)?.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[^0-9]/g,'')||null,school:clean(identity.school),gender:clean(identity.gender),stage:clean(identity.stage),grade:clean(identity.grade)};return NextResponse.json({identity:normalized,subjects:subjects.map(name=>parsed.subjects.find((s:any)=>s.name===name))});
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.name==='AbortError'?'انتهت مهلة تحليل الصورة':'تعذر تحليل الورقة بالذكاء الاصطناعي'},{status:500})}
}
