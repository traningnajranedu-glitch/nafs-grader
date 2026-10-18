export type Point={x:number;y:number};
export type Reading={questionNumber:number;selected:string|null;state:'clear'|'blank'|'multiple'|'uncertain';ratios:number[]};
export function bubbleCenters(points:Point[],rows=20){if(points.length!==3||rows<2)throw Error('أكمل نقاط المعايرة الثلاث');const [a,d,last]=points;const dx=(d.x-a.x)/3,dy=(d.y-a.y)/3;if(Math.hypot(dx,dy)<8||Math.hypot(last.x-a.x,last.y-a.y)<100)throw Error('نقاط المعايرة متقاربة أو غير صحيحة');return Array.from({length:rows},(_,r)=>Array.from({length:4},(_,c)=>({x:a.x+c*dx+r*(last.x-a.x)/(rows-1),y:a.y+c*dy+r*(last.y-a.y)/(rows-1)})))}
export function classify(ratios:number[],questionNumber:number,faintRatios:number[]=ratios):Reading{const ranked=ratios.map((value,i)=>({value,i})).sort((a,b)=>b.value-a.value);const high=ranked.filter(x=>x.value>=.58);let state:Reading['state']='uncertain';if(high.length>1)state='multiple';else if(high.length===1&&ranked[0].value-ranked[1].value>=.22)state='clear';else if(ranked[0].value<.3)state=faintRatios.some(x=>x>=.45)?'uncertain':'blank';return {questionNumber,selected:state==='blank'?null:'ABCD'[ranked[0].i],state,ratios}}
export function readBubbles(image:ImageData,points:Point[],questionNumbers:number[]){const centers=bubbleCenters(points);const radius=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)/3*.24;return questionNumbers.map(n=>{if(n<1||n>20)throw Error('النسخة التجريبية تدعم الأسئلة من 1 إلى 20 لكل مادة');const ratios=centers[n-1].map(p=>{let dark=0,count=0;for(let y=Math.floor(p.y-radius);y<=p.y+radius;y++)for(let x=Math.floor(p.x-radius);x<=p.x+radius;x++){if((x-p.x)**2+(y-p.y)**2>radius**2)continue;if(x<0||y<0||x>=image.width||y>=image.height)throw Error('دوائر خارج حدود الصورة؛ أعد المعايرة');const i=(y*image.width+x)*4;const gray=.299*image.data[i]+.587*image.data[i+1]+.114*image.data[i+2];if(gray<150)dark++;count++}return count?dark/count:0});return classify(ratios,n)})}

/** Hybrid OMR V3: combine absolute ink, faint ink and separation from the runner-up.
 * Keep ambiguous marks for review; a suggested letter is not an approved answer.
 */
export function classifyHybrid(dark:number[],faint:number[],questionNumber:number):Reading{
 if(dark.length!==4||faint.length!==4||[...dark,...faint].some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('نسب تظليل غير صالحة');
 const ranked=dark.map((value,i)=>({value,i})).sort((a,b)=>b.value-a.value);
 const top=ranked[0],runner=ranked[1],gap=top.value-runner.value;
 const faintTop=Math.max(...faint);
 const strong=dark.filter(v=>v>=.52).length;
 let state:Reading['state']='uncertain';
 if(strong>1||(runner.value>=.36&&gap<.16))state='multiple';
 else if(top.value<.20&&faintTop<.32)state='blank';
 else if(top.value>=.42&&gap>=.18&&top.value>=runner.value*1.65)state='clear';
 return {questionNumber,selected:state==='blank'?null:'ABCD'[top.i],state,ratios:dark};
}
