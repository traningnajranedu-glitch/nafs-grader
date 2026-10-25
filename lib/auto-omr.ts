import {classifyHybrid,type Point,type Reading} from './omr';
export type SheetMeta={v:2;kind:'student'|'key';school:string;schoolId:string;name:string;code:string;gender:string;stage:string;grade:string;anchors:Point[][]};
export const normalize=(s:string)=>s.trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');
export function components(image:ImageData,diagonal=false){const {width:w,height:h,data}=image;const visited=new Uint8Array(w*h),stack:number[]=[];const out:{x:number;y:number;w:number;h:number;area:number}[]=[];const black=(i:number)=>data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114<175;for(let i=0;i<w*h;i++){if(visited[i]||!black(i))continue;visited[i]=1;stack.push(i);let minX=w,maxX=0,minY=h,maxY=0,area=0;while(stack.length){const p=stack.pop()!,x=p%w,y=Math.floor(p/w);area++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1,...(diagonal?[x>0&&y>0?p-w-1:-1,x<w-1&&y>0?p-w+1:-1,x>0&&y<h-1?p+w-1:-1,x<w-1&&y<h-1?p+w+1:-1]:[])])if(n>=0&&!visited[n]&&black(n)){visited[n]=1;stack.push(n)}}if(area>15)out.push({x:(minX+maxX)/2,y:(minY+maxY)/2,w:maxX-minX+1,h:maxY-minY+1,area})}return out}
export function markerTransform(image:ImageData){const cs=components(image);const bounds=[[0,0],[1,0],[0,1],[1,1]].map(([rx,ry])=>cs.filter(c=>c.w>8&&c.w<image.width*.055&&c.h>8&&c.h<image.height*.04&&c.w/c.h>.65&&c.w/c.h<1.5&&c.area/(c.w*c.h)>.5&&(rx?c.x>image.width*.85:c.x<image.width*.15)&&(ry?c.y>image.height*.85:c.y<image.height*.15)).sort((a,b)=>Math.abs(a.x-(rx?image.width:0))+Math.abs(a.y-(ry?image.height:0))-Math.abs(b.x-(rx?image.width:0))-Math.abs(b.y-(ry?image.height:0)))[0]);if(bounds.some(x=>!x))throw Error('تعذر تحديد علامات الورقة الأربع؛ استخدم مسحًا ضوئيًا كاملًا وواضحًا');const src=[{x:28.5,y:28.5},{x:765.5,y:28.5},{x:28.5,y:1092.5},{x:765.5,y:1092.5}];const mat:number[][]=[];src.forEach((p,i)=>{const q=bounds[i];mat.push([p.x,p.y,1,0,0,0,-q.x*p.x,-q.x*p.y,q.x],[0,0,0,p.x,p.y,1,-q.y*p.x,-q.y*p.y,q.y])});for(let i=0;i<8;i++){let pivot=i;for(let j=i+1;j<8;j++)if(Math.abs(mat[j][i])>Math.abs(mat[pivot][i]))pivot=j;[mat[i],mat[pivot]]=[mat[pivot],mat[i]];const d=mat[i][i];if(Math.abs(d)<1e-8)throw Error('علامات غير صالحة');for(let k=i;k<9;k++)mat[i][k]/=d;for(let j=0;j<8;j++)if(j!==i){const f=mat[j][i];for(let k=i;k<9;k++)mat[j][k]-=f*mat[i][k]}}const h=mat.map(x=>x[8]);return (p:Point)=>{const z=h[6]*p.x+h[7]*p.y+1;return {x:(h[0]*p.x+h[1]*p.y+h[2])/z,y:(h[3]*p.x+h[4]*p.y+h[5])/z}}}
function readRow(image:ImageData,centers:Point[],question:number,sampleRadius?:number){
 const spacing=Math.hypot(centers[1].x-centers[0].x,centers[1].y-centers[0].y);
 const radius=sampleRadius??Math.max(3,spacing*.205);
 const gray=(x:number,y:number)=>{const i=(y*image.width+x)*4;return .299*image.data[i]+.587*image.data[i+1]+.114*image.data[i+2]};
 const ratios=centers.map(p=>{
  const background:number[]=[];
  for(let k=0;k<32;k++){const angle=k*Math.PI/16,x=Math.round(p.x+Math.cos(angle)*radius*1.7),y=Math.round(p.y+Math.sin(angle)*radius*1.7);if(x>=0&&y>=0&&x<image.width&&y<image.height)background.push(gray(x,y))}
  background.sort((a,b)=>a-b);
  const white=background[Math.floor(background.length*.8)]??245;
  const darkThreshold=Math.min(180,white-48),faintThreshold=Math.min(210,white-25);
  let dark=0,faint=0,n=0;
  // Sample the interior, not the printed ring, and tolerate small alignment errors.
  for(let y=Math.floor(p.y-radius);y<=p.y+radius;y++)for(let x=Math.floor(p.x-radius);x<=p.x+radius;x++){
   if((x-p.x)**2+(y-p.y)**2>radius**2)continue;
   if(x<0||y<0||x>=image.width||y>=image.height)throw Error('مواضع إجابة خارج الورقة');
   const value=gray(x,y);if(value<darkThreshold)dark++;if(value<faintThreshold)faint++;n++;
  }
  return {dark:n?dark/n:0,faint:n?faint/n:0};
 });
 return {...classifyHybrid(ratios.map(x=>x.dark),ratios.map(x=>x.faint),question),faintRatios:ratios.map(x=>x.faint)};
}
export function autoRead(image:ImageData,anchors:Point[][]){const map=markerTransform(image);return anchors.map(points=>Array.from({length:20},(_,r)=>{const centers=Array.from({length:4},(_,c)=>map({x:points[0].x+c*(points[1].x-points[0].x)/3+r*(points[2].x-points[0].x)/19,y:points[0].y+c*(points[1].y-points[0].y)/3+r*(points[2].y-points[0].y)/19}));return readRow(image,centers,r+1)}))}
type Component={x:number;y:number;w:number;h:number;area:number};
const median=(values:number[])=>{const a=[...values].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
function lineFit(points:Point[],swap=false){
 const xs=points.map(p=>swap?p.y:p.x),ys=points.map(p=>swap?p.x:p.y);
 const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
 const variance=xs.reduce((s,x)=>s+(x-mx)**2,0);
 if(variance<1)throw Error('نقاط محاذاة غير كافية');
 const a=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/variance;
 return {a,b:my-a*mx};
}
/** Fit the printed lattice, including the gaps after each five questions.
 * No question positions are taken from the answer key or page proportions.
 */
function adaptiveLegacyGeometry(image:ImageData){
 const broad=components(image,true).filter(c=>c.y>image.height*.23&&c.y<image.height*.97&&
  c.w>=image.width*.009&&c.w<=image.width*.06&&c.h>=image.width*.009&&c.h<=image.width*.06&&
  c.w/c.h>.72&&c.w/c.h<1.35&&c.area/(c.w*c.h)>.08);
 if(broad.length<160)throw Error('دوائر الإجابة غير مكتملة');
 const votes=new Map<number,number>();
 for(const c of broad){const bin=Math.round(c.w/2);votes.set(bin,(votes.get(bin)||0)+1)}
 const peak=[...votes].sort((a,b)=>b[1]-a[1])[0][0]*2;
 const diameter=median(broad.filter(c=>Math.abs(c.w-peak)<=3).map(c=>c.w));
 const circles=broad.filter(c=>c.w>diameter*.8&&c.w<diameter*1.22&&c.h>diameter*.8&&c.h<diameter*1.22);
 if(circles.length<160)throw Error('عدد الدوائر المطابقة غير كافٍ');
 // Robust deskew: vertical neighbours across hundreds of printed circles vote.
 const slopes:number[]=[];
 for(const p of circles){const neighbours=circles.filter(q=>q.y-p.y>diameter*.85&&q.y-p.y<diameter*3.2&&Math.abs(q.x-p.x)<(q.y-p.y)*.2);
  if(neighbours.length){const q=neighbours.sort((a,b)=>a.y-b.y)[0];slopes.push((q.x-p.x)/(q.y-p.y))}}
 if(slopes.length<100)throw Error('تعذر تقدير ميل شبكة الإجابات');
 const skew=median(slopes),groups:Component[][]=[];
 const projectedX=(p:Point)=>p.x-skew*p.y;
 for(const c of [...circles].sort((a,b)=>projectedX(a)-projectedX(b))){
  const g=groups.find(g=>Math.abs(median(g.map(projectedX))-projectedX(c))<diameter*.46);
  if(g)g.push(c);else groups.push([c]);
 }
 const columns=groups.filter(g=>g.length>=10&&g.length<=23).sort((a,b)=>median(a.map(projectedX))-median(b.map(projectedX)));
 if(columns.length!==12)throw Error('تعذر التحقق من أعمدة الإجابات الاثني عشر');
 const xs=columns.map(g=>median(g.map(projectedX)));
 const pitches=Array.from({length:3},(_,g)=>[1,2,3].map(i=>xs[g*4+i]-xs[g*4+i-1]));
 const pitch=median(pitches.flat());
 if(pitches.flat().some(d=>d<diameter*.88||Math.abs(d-pitch)>pitch*.22)||[4,8].some(i=>xs[i]-xs[i-1]<pitch*1.4))throw Error('تباعد خيارات الإجابة غير منتظم');
 let rows:Component[][]=[];
 const projectedY=(p:Point)=>p.y+skew*p.x;
 for(const c of columns.flat().sort((a,b)=>projectedY(a)-projectedY(b))){
  const g=rows[rows.length-1];
  if(g&&Math.abs(projectedY(c)-median(g.map(projectedY)))<diameter*.6)g.push(c);else rows.push([c]);
 }
 rows=rows.filter(g=>g.length>=4);
 // Missing an entire row must never renumber the remaining questions.
 if(rows.length!==20||rows.some(g=>g.length<4||g.length>12))throw Error('تعذر التحقق من صفوف الأسئلة العشرين');
 const ys=rows.map(g=>median(g.map(projectedY)));
 if(ys.slice(1).some((y,i)=>y-ys[i]<diameter*.9||y-ys[i]>diameter*3.5))throw Error('تباعد صفوف الأسئلة لا يطابق شبكة كاملة');
 const columnLines=columns.map(g=>lineFit(g,true));
 const grid=rows.map((row,ri)=>{
  const rowLine=lineFit(row);
  return columns.map((column,ci)=>{
   const col=columnLines[ci],denominator=1-rowLine.a*col.a;
   if(Math.abs(denominator)<.9)throw Error('منظور الورقة غير صالح');
   const y=(rowLine.a*col.b+rowLine.b)/denominator,x=col.a*y+col.b;
   const nearby=column.filter(c=>Math.hypot(c.x-x,c.y-y)<diameter*.38);
   if(nearby.length>1)throw Error('دوائر متداخلة في موضع سؤال');
   // An obscured/merged component may be recovered only when its printed
   // ring is actually present at the independent row/column intersection.
   if(!nearby.length){
    let supported=0;
    for(let k=0;k<32;k++){
     const angle=k*Math.PI/16;
     let ink=false;
     for(const scale of [.43,.47,.51,.55]){
      const px=Math.round(x+Math.cos(angle)*diameter*scale),py=Math.round(y+Math.sin(angle)*diameter*scale);
      if(px<0||py<0||px>=image.width||py>=image.height)continue;
      const i=(py*image.width+px)*4;
      if(image.data[i]*.299+image.data[i+1]*.587+image.data[i+2]*.114<190)ink=true;
     }
     if(ink)supported++;
    }
    if(supported<18)throw Error('تعذر التحقق بصريًا من دائرة مستعادة في السؤال '+(ri+1));
   }
   return nearby.length?{x:nearby[0].x,y:nearby[0].y}:{x,y};
  });
 });
 return {diameter,grid:[0,1,2].map(g=>grid.map(row=>[0,1,2,3].map(o=>row[11-g*4-o])))};
}
export function legacyGrid(image:ImageData){return adaptiveLegacyGeometry(image).grid}
export function readLegacy(image:ImageData){
 try{
  const {grid,diameter}=adaptiveLegacyGeometry(image);
  return grid.map(rows=>{
   const raw=rows.map((centers,r)=>readRow(image,centers,r+1,diameter*.38));
   // Arabic option glyphs contribute ink even to empty circles. Calibrate
   // each option against its observed lower quartile on this subject only.
   const baseline=(field:'ratios'|'faintRatios')=>[0,1,2,3].map(i=>{
    const values=raw.map(r=>r[field][i]).sort((a,b)=>a-b),v=values[Math.floor(values.length*.2)];
    return v<=.28?v:0;
   });
   const darkBase=baseline('ratios'),faintBase=baseline('faintRatios');
   return raw.map(r=>{
    const adjust=(values:number[],base:number[])=>values.map((v,i)=>Math.max(0,(v-base[i])/(1-base[i])));
    return {...classifyHybrid(adjust(r.ratios,darkBase),adjust(r.faintRatios,faintBase),r.questionNumber),rawRatios:r.ratios};
   });
  });
 }catch(e){
  const reason=e instanceof Error?e.message:String(e);
  throw Error('تعذر تحديد مراكز دوائر الإجابة المطبوعة بثقة: '+reason+'؛ أعد المسح أو راجع الورقة يدويًا.');
 }
}
export async function renderPdf(file:File,onPage:(canvas:HTMLCanvasElement,text:string,page:number,total:number)=>Promise<void>){if(file.size>50*1024*1024)throw Error('الحد الأقصى 50 ميجابايت');const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;try{if(pdf.numPages>250)throw Error('الحد الأقصى 250 صفحة');for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:1500/p.getViewport({scale:1}).width});const c=document.createElement('canvas');c.width=Math.round(v.width);c.height=Math.round(v.height);await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;const t=await p.getTextContent();await onPage(c,t.items.map((x:any)=>x.str||'').join('\n'),n,pdf.numPages);c.width=0;c.height=0;p.cleanup()}}finally{await pdf.destroy()}}
export async function decodeMeta(c:HTMLCanvasElement):Promise<SheetMeta|null>{try{const {BrowserQRCodeReader}=await import('@zxing/browser');const text=new BrowserQRCodeReader().decodeFromCanvas(c).getText();const parsed=JSON.parse(text);if(parsed.v===2&&['student','key'].includes(parsed.kind)&&['school','schoolId','name','code','gender','stage','grade'].every(k=>typeof parsed[k]==='string'&&parsed[k].length<=300)&&Array.isArray(parsed.anchors)&&parsed.anchors.length===3&&parsed.anchors.every((a:any)=>Array.isArray(a)&&a.length===3&&a.every((p:any)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=794&&p.y>=0&&p.y<=1123)))return parsed;}catch{}return null}
export function detectAnchors(image:ImageData){
const size=image.width/794*24;const map=markerTransform(image);
const inverse=(target:Point)=>{let p={x:target.x*794/image.width,y:target.y*1123/image.height};for(let i=0;i<8;i++){const q=map(p),dx=map({x:p.x+1,y:p.y}),dy=map({x:p.x,y:p.y+1});const a=dx.x-q.x,b=dy.x-q.x,c=dx.y-q.y,d=dy.y-q.y,z=a*d-b*c;if(Math.abs(z)<1e-8)throw Error('تعذر محاذاة الورقة');const ex=target.x-q.x,ey=target.y-q.y;p={x:p.x+(d*ex-b*ey)/z,y:p.y+(-c*ex+a*ey)/z}}return p};
const circles=components(image).filter(c=>c.y>image.height*.32&&c.y<image.height*.94&&c.w>size*.7&&c.w<size*1.3&&c.h>size*.7&&c.h<size*1.3&&c.w/c.h>.8&&c.w/c.h<1.25&&c.area/(c.w*c.h)>.1).map(c=>inverse(c));
const groups:Point[][]=[];for(const c of circles.sort((a,b)=>a.y-b.y)){const g=groups.find(g=>Math.abs(g.reduce((s,x)=>s+x.y,0)/g.length-c.y)<24*.45);if(g)g.push(c);else groups.push([c])}const rows=groups.filter(g=>g.length===12).sort((a,b)=>a[0].y-b[0].y);if(rows.length!==20)throw Error('تعذر التعرف على جميع دوائر الإجابة؛ راجع وضوح النموذج');const first=rows[0].sort((a,b)=>b.x-a.x),last=rows[19].sort((a,b)=>b.x-a.x);return [0,1,2].map(i=>[first[i*4],first[i*4+3],last[i*4]])}

