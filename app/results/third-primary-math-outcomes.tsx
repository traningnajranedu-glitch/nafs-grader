'use client';

type QuestionStat={stage:string;subject:string;number:number;responses:number;correct:number;percent:number;difficulty:string};
type Indicator={title:string;questions:number[]};
type Outcome={title:string;questions:number[];indicators:Indicator[]};

const outcomes:Outcome[]=[
 {title:'إيجاد نواتج جمع الأعداد الكلية وطرحها ضمن ثلاث منازل وتقديرها وحل مسائل رياضية عليها تتضمن تطبيقات حياتية',questions:[1,2,4],indicators:[
  {title:'يحل مسائل رياضية من خطوة أو خطوتين تتضمن تطبيقات حياتية على الجمع والطرح ضمن ثلاث منازل ويفسر حلها',questions:[1,4]},
  {title:'يقدر نواتج الجمع والطرح ضمن ثلاث منازل باستخدام التقريب إلى المنزلة المناسبة أو الأعداد المتناغمة، ويستخدم التقدير للتحقق من معقولية الناتج',questions:[2]}
 ]},
 {title:'فهم القيمة المنزلية للأعداد ضمن أربع منازل واستخدامها في تمثيل الأعداد وقراءتها وكتابتها والمقارنة بينها وترتيبها وتقريبها',questions:[3,5,6,7,8,9,12,13,14,16,17,18,19,20],indicators:[
  {title:'يعد ضمن أربع منازل تصاعديًا وتنازليًا وقفزيًا (اثنينات وخمسات وعشرات ومئات وألوف)، ويحدد العدد الزوجي والفردي',questions:[3,8,12,16,19]},
  {title:'يحدد القيمة المنزلية لرقم في عدد ضمن أربع منازل ويمثل الأعداد باستخدام النماذج والرسوم وخط الأعداد ويقربها إلى أقرب عشرة أو مئة أو ألف',questions:[5,6,7,9]},
  {title:'يقرأ الأعداد ضمن أربع منازل ويكتبها في الصور القياسية واللفظية والتحليلية',questions:[13,20]},
  {title:'يقارن بين الأعداد ضمن أربع منازل باستخدام الرموز (>، =، <) ويرتبها تصاعديًا وتنازليًا',questions:[14,17,18]}
 ]},
 {title:'تمييز فئات النقود واستخدامها في العد وتمثيل المبالغ والمقارنة بينها وحل مسائل رياضية عليها تتضمن تطبيقات مالية',questions:[10,15],indicators:[
  {title:'يميز فئات النقود المعدنية والورقية ويستخدمها في عد المبالغ ضمن 999 ريالًا، ويحل مسائل رياضية تتضمن تطبيقات مالية ويفسر حلها',questions:[10,15]}
 ]},
 {title:'تمييز خصائص العمليات الأربع واستخدامها لإيجاد النواتج والتحقق من صحتها',questions:[11],indicators:[
  {title:'يميز خاصية الإبدال في الجمع ويستخدمها لإيجاد النواتج والتحقق من صحتها',questions:[11]}
 ]}
];

const answerKey:Record<number,string>={1:'ج',2:'د',3:'ج',4:'ب',5:'ج',6:'ب',7:'ب',8:'أ',9:'د',10:'ج',11:'ج',12:'ب',13:'أ',14:'د',15:'د',16:'أ',17:'ب',18:'ب',19:'ج',20:'ج'};

function summarize(rows:QuestionStat[],numbers:number[]){
 const selected=rows.filter(q=>numbers.includes(Number(q.number)));
 const responses=selected.reduce((n,q)=>n+Number(q.responses||0),0);
 const correct=selected.reduce((n,q)=>n+Number(q.correct||0),0);
 return {responses,correct,percent:responses?100*correct/responses:null,available:selected.length};
}
function fmt(v:number|null){return v===null?'—':v.toFixed(1)+'%';}
function Bar({value}:{value:number|null}){return <div className="tpm-track"><span style={{width:(value===null?0:Math.max(0,Math.min(100,value)))+'%'}}/></div>}

export default function ThirdPrimaryMathOutcomes({questions}:{questions:QuestionStat[]}){
 const mapped=outcomes.map(o=>({...o,stats:summarize(questions,o.questions),indicators:o.indicators.map(i=>({...i,stats:summarize(questions,i.questions)}))}));
 const hasEvidence=questions.some(q=>Number(q.responses)>0);
 return <section className="tpm-panel" aria-label="مؤشرات نواتج تعلم الرياضيات للصف الثالث الابتدائي">
  <div className="tpm-head"><div><span className="tpm-eyebrow">LEARNING OUTCOMES / MATHEMATICS</span><h2>محاكي رياضيات ثالث ابتدائي</h2><p>لوحة قياس نواتج التعلم والمؤشرات من الأسئلة العشرين في النموذج المرفق</p></div><div className="tpm-total"><b>20</b><span>سؤالًا في النموذج</span></div></div>
  <div className="tpm-summary">
   <article><b>4</b><span>نواتج تعلم</span></article><article><b>8</b><span>مؤشرات أداء</span></article><article><b>20</b><span>سؤالًا موزعًا</span></article><article><b>{hasEvidence?'متاح':'بانتظار البيانات'}</b><span>حالة تحليل النتائج</span></article>
  </div>
  {!hasEvidence&&<div className="tpm-note">خريطة المؤشرات ومفتاح الإجابة ظاهران من الملف المرجعي. لا توجد إجابات موثقة في نطاق الفلاتر الحالي لاحتساب الإتقان؛ لن تُعرض نسبة افتراضية.</div>}
  <div className="tpm-outcomes">{mapped.map((o,index)=><article className="tpm-outcome" key={index}>
   <div className="tpm-outcome-top"><span>ناتج التعلم {index+1}</span><strong>{fmt(o.stats.percent)}</strong></div>
   <h3>{o.title}</h3><div className="tpm-meta"><span>الأسئلة: {o.questions.join('، ')}</span><span>{o.stats.available} من {o.questions.length} سؤالًا في بيانات التحليل</span><span>{o.stats.responses.toLocaleString('ar-SA')} إجابة موثقة</span></div><Bar value={o.stats.percent}/>
   <div className="tpm-indicators">{o.indicators.map((indicator,i)=><div className="tpm-indicator" key={i}>
    <div className="tpm-indicator-title"><span>{indicator.title}</span><b>{fmt(indicator.stats.percent)}</b></div>
    <div className="tpm-meta"><span>الأسئلة: {indicator.questions.join('، ')}</span><span>{indicator.stats.responses.toLocaleString('ar-SA')} إجابة موثقة</span></div><Bar value={indicator.stats.percent}/>
   </div>)}</div>
  </article>)}</div>
  <article className="tpm-key"><div className="tpm-key-head"><h3>مفتاح الإجابة المرجعي</h3><span>من الملف المرفق — 20 سؤالًا</span></div><div className="tpm-key-grid">{Array.from({length:20},(_,i)=>i+1).map(n=><div key={n}><small>س{n}</small><b>{answerKey[n]}</b></div>)}</div></article>
  <p className="tpm-foot">طريقة الاحتساب: مجموع الإجابات الصحيحة ÷ مجموع الإجابات الموثقة للأسئلة المرتبطة بالمؤشر × 100. تُعرض نسب المؤشرات من نتائج الأسئلة التي اجتازت التحقق التفصيلي فقط، ولا تمثل اعتمادًا رسميًا. توزيع الأسئلة ومفتاح الإجابة من ملف محاكي رياضيات ثالث ابتدائي المرفق.</p>
  <style>{`
   .tpm-panel{margin:22px 0;padding:0!important;overflow:hidden;border:1px solid #4c9da7!important;background:linear-gradient(145deg,#062c46,#073f59)!important;color:#eafaff!important}
   .tpm-head{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:25px;background:radial-gradient(ellipse at 85% 0%,#0e8790aa,transparent 60%)}
   .tpm-eyebrow{font:600 10px ui-monospace,monospace;letter-spacing:1.4px;color:#7be7d3}.tpm-head h2{font-size:26px;margin:9px 0;color:#ffe0a0}.tpm-head p{margin:0;color:#c5e3ec;font-size:13px}.tpm-total{min-width:100px;text-align:center;border:1px solid #76d9c766;border-radius:15px;padding:12px;background:#062a43aa}.tpm-total b{display:block;font-size:34px;color:#8af1d9}.tpm-total span{font-size:11px;color:#c1e3e8}
   .tpm-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 20px 18px}.tpm-summary article{background:#0a5265;border:1px solid #64b8b466;border-radius:12px;padding:13px;text-align:center}.tpm-summary b{display:block;font-size:21px;color:#ffe0a0}.tpm-summary span{font-size:11px;color:#cce8ed}
   .tpm-note{margin:0 20px 18px;padding:13px 16px;background:#4a3b20;border:1px solid #c6a65c88;border-radius:10px;color:#ffedc2;font-size:12px;line-height:1.9}
   .tpm-outcomes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:0 20px}
   .tpm-outcome{background:linear-gradient(145deg,#0a4a62,#082f4a)!important;border:1px solid #56aeb766!important;border-radius:14px!important;padding:17px!important;margin:0!important}
   .tpm-outcome-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.tpm-outcome-top span{font-size:11px;color:#7fe5d5}.tpm-outcome-top strong{font-size:25px;color:#ffe0a0}.tpm-outcome h3{font-size:14px;line-height:1.9;margin:8px 0;color:#f1fbff}
   .tpm-meta{display:flex;flex-wrap:wrap;gap:7px 14px;font-size:10px;color:#b6d9e3;margin:8px 0}.tpm-track{height:8px;border-radius:10px;background:#ffffff1b;overflow:hidden}.tpm-track span{display:block;height:100%;border-radius:10px;background:linear-gradient(90deg,#1eb5b2,#9cf1c8);transition:width .6s}
   .tpm-indicators{display:grid;gap:11px;margin-top:16px;padding-top:13px;border-top:1px solid #80d7d42b}.tpm-indicator-title{display:flex;justify-content:space-between;gap:12px;align-items:start}.tpm-indicator-title span{font-size:11px;line-height:1.9;color:#d9eef2}.tpm-indicator-title b{white-space:nowrap;color:#8ff0d7;font-size:13px}.tpm-indicator .tpm-meta{margin:4px 0 7px}
   .tpm-key{margin:18px 20px!important;padding:16px!important;background:#082b43!important;border:1px solid #b99b5c77!important}.tpm-key-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.tpm-key h3{margin:0;color:#ffe0a0;font-size:15px}.tpm-key-head span{color:#b8d6df;font-size:11px}.tpm-key-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:7px;margin-top:13px}.tpm-key-grid>div{display:grid;gap:3px;text-align:center;background:#0d5063;border-radius:8px;padding:8px 2px}.tpm-key-grid small{margin:0;color:#c0e3e9;font-size:10px}.tpm-key-grid b{font-size:15px;color:#ffe0a0}
   .tpm-foot{margin:0!important;padding:14px 20px 20px!important;color:#b7d5de!important;font-size:11px!important;line-height:1.9}
   @media(max-width:760px){.tpm-outcomes{grid-template-columns:1fr}.tpm-summary{grid-template-columns:repeat(2,1fr)}.tpm-head{align-items:flex-start}.tpm-key-grid{grid-template-columns:repeat(5,1fr)}.tpm-key-head{align-items:flex-start;flex-direction:column}}
   @media print{.tpm-panel{background:white!important;color:#143c50!important;break-inside:auto}.tpm-outcome,.tpm-key{background:white!important;color:#143c50!important;border:1px solid #ccd9df!important;break-inside:avoid}.tpm-outcome h3,.tpm-indicator-title span,.tpm-key h3,.tpm-foot{color:#143c50!important}.tpm-outcome-top strong,.tpm-indicator-title b,.tpm-key-grid b{color:#075e66!important}.tpm-key-grid>div{background:#eef5f6!important}.tpm-key-grid small,.tpm-key-head span,.tpm-meta{color:#45616e!important}.tpm-track{background:#e5edf0}.tpm-track span{print-color-adjust:exact}}
  `}</style>
 </section>;
}
