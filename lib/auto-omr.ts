import {classify,type Point,type Reading} from './omr';
export type SheetMeta={v:2;kind:'student'|'key';school:string;schoolId:string;name:string;code:string;gender:string;stage:string;grade:string;anchors:Point[][]};
export const normalize=(s:string)=>s.trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');
export function components(image:ImageData){const {width:w,height:h,data}=image;const visited=new Uint8Array(w*h),stack:number[]=[];const out:{x:number;y:number;w:number;h:number;area:number}[]=[];const black=(i:number)=>data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114<175;for(let i=0;i<w*h;i++){if(visited[i]||!black(i))continue;visited[i]=1;stack.push(i);let minX=w,maxX=0,minY=h,maxY=0,area=0;while(stack.length){const p=stack.pop()!,x=p%w,y=Math.floor(p/w);area++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(n>=0&&!visited[n]&&black(n)){visited[n]=1;stack.push(n)}}if(area>15)out.push({x:(minX+maxX)/2,y:(minY+maxY)/2,w:maxX-minX+1,h:maxY-minY+1,area})}return out}
export function markerTransform(image:ImageData){const cs=components(image);const bounds=[[0,0],[1,0],[0,1],[1,1]].map(([rx,ry])=>cs.filter(c=>c.w>8&&c.w<image.width*.055&&c.h>8&&c.h<image.height*.04&&c.w/c.h>.65&&c.w/c.h<1.5&&c.area/(c.w*c.h)>.5&&(rx?c.x>image.width*.85:c.x<image.width*.15)&&(ry?c.y>image.height*.85:c.y<image.height*.15)).sort((a,b)=>Math.abs(a.x-(rx?image.width:0))+Math.abs(a.y-(ry?image.height:0))-Math.abs(b.x-(rx?image.width:0))-Math.abs(b.y-(ry?image.height:0)))[0]);if(bounds.some(x=>!x))throw Error('تعذر تحديد علامات الورقة الأربع؛ استخدم مسحًا ضوئيًا كاملًا وواضحًا');const src=[{x:28.5,y:28.5},{x:765.5,y:28.5},{x:28.5,y:1092.5},{x:765.5,y:1092.5}];const mat:number[][]=[];src.forEach((p,i)=>{const q=bounds[i];mat.push([p.x,p.y,1,0,0,0,-q.x*p.x,-q.x*p.y,q.x],[0,0,0,p.x,p.y,1,-q.y*p.x,-q.y*p.y,q.y])});for(let i=0;i<8;i++){let pivot=i;for(let j=i+1;j<8;j++)if(Math.abs(mat[j][i])>Math.abs(mat[pivot][i]))pivot=j;[mat[i],mat[pivot]]=[mat[pivot],mat[i]];const d=mat[i][i];if(Math.abs(d)<1e-8)throw Error('علامات غير صالحة');for(let k=i;k<9;k++)mat[i][k]/=d;for(let j=0;j<8;j++)if(j!==i){const f=mat[j][i];for(let k=i;k<9;k++)mat[j][k]-=f*mat[i][k]}}const h=mat.map(x=>x[8]);return (p:Point)=>{const z=h[6]*p.x+h[7]*p.y+1;return {x:(h[0]*p.x+h[1]*p.y+h[2])/z,y:(h[3]*p.x+h[4]*p.y+h[5])/z}}}
function readRow(image:ImageData,centers:Point[],question:number){
 const spacing=Math.hypot(centers[1].x-centers[0].x,centers[1].y-centers[0].y);
 const radius=Math.max(3,spacing*.205);
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
 return classify(ratios.map(x=>x.dark),question,ratios.map(x=>x.faint));
}
export function autoRead(image:ImageData,anchors:Point[][]){const map=markerTransform(image);return anchors.map(points=>Array.from({length:20},(_,r)=>{const centers=Array.from({length:4},(_,c)=>map({x:points[0].x+c*(points[1].x-points[0].x)/3+r*(points[2].x-points[0].x)/19,y:points[0].y+c*(points[1].y-points[0].y)/3+r*(points[2].y-points[0].y)/19}));return readRow(image,centers,r+1)}))}
export function legacyGrid(image:ImageData){
 const size=image.width/794*24;const broad=components(image).filter(c=>c.y>image.height*.32&&c.y<image.height*.94&&c.w>size*.65&&c.w<size*1.5&&c.h>size*.65&&c.h<size*1.6&&c.w/c.h>.65&&c.w/c.h<1.3&&c.area/(c.w*c.h)>.08);
 const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]};if(broad.length<180)throw Error('دوائر الإجابة غير واضحة');const w=median(broad.map(c=>c.w)),h=median(broad.map(c=>c.h));const circles=broad.filter(c=>c.w>w*.75&&c.w<w*1.3&&c.h>h*.75&&c.h<h*1.3).sort((a,b)=>b.w*b.h-a.w*a.h);const unique:typeof circles=[];for(const c of circles)if(!unique.some(p=>Math.hypot(p.x-c.x,p.y-c.y)<w*.45))unique.push(c);
 const clusters:typeof circles[]=[];for(const c of unique.sort((a,b)=>a.x-b.x)){const group=clusters.find(g=>Math.abs(g.reduce((s,p)=>s+p.x,0)/g.length-c.x)<w*.45);if(group)group.push(c);else clusters.push([c])}const columns=clusters.filter(g=>g.length>=15&&g.length<=21).sort((a,b)=>a[0].x-b[0].x);if(columns.length!==12)throw Error('تعذر تحديد أعمدة دوائر الإجابة الاثني عشر');const top=median(columns.map(g=>Math.min(...g.map(p=>p.y)))),bottom=median(columns.map(g=>Math.max(...g.map(p=>p.y)))),pitch=(bottom-top)/19;if(pitch<h||pitch>h*2)throw Error('تباعد الأسئلة لا يطابق النموذج');
 const fitted=columns.map(column=>{const sorted=column.sort((a,b)=>a.y-b.y);const first=Math.abs(sorted[0].y-top)<pitch*.35?sorted[0].y:top;const last=Math.abs(sorted[sorted.length-1].y-bottom)<pitch*.35?sorted[sorted.length-1].y:bottom;const step=(last-first)/19;const meanX=column.reduce((s,p)=>s+p.x,0)/column.length,meanY=column.reduce((s,p)=>s+p.y,0)/column.length;const slope=column.reduce((s,p)=>s+(p.x-meanX)*(p.y-meanY),0)/column.reduce((s,p)=>s+(p.y-meanY)**2,0);return Array.from({length:20},(_,r)=>{const y=first+r*step;const nearest=column.reduce((best,p)=>Math.abs(p.y-y)<Math.abs(best.y-y)?p:best);return Math.abs(nearest.y-y)<step*.3?{x:nearest.x,y:nearest.y}:{x:meanX+slope*(y-meanY),y}})});
 return [0,1,2].map(g=>Array.from({length:20},(_,r)=>[0,1,2,3].map(option=>fitted[11-g*4-option][r])));
}
function templateGrid(image:ImageData){
 const {width:w,height:h}=image;
 if(w/h<.67||w/h>.79)throw Error('أبعاد الورقة لا تطابق نموذج نافس');
 const groupsX=[[.154,.202,.251,.299],[.417,.465,.514,.563],[.680,.728,.777,.826]];
 const first=.389,last=.887;
 return groupsX.map(xs=>Array.from({length:20},(_,r)=>xs.map(x=>({x:x*w,y:(first+(last-first)*r/19)*h})))).reverse();
}
export function readLegacy(image:ImageData){
 let detected:Point[][][]|null=null;
 try{detected=legacyGrid(image)}catch{}
 let base:Point[][][]|null=null;
 try{base=templateGrid(image)}catch{if(!detected)throw Error('أبعاد الورقة لا تطابق النموذج المعتمد')}
 const evaluate=(grid:Point[][][])=>{
  const readings=grid.map(rows=>rows.map((centers,r)=>readRow(image,centers,r+1)));
  const first=readings.flatMap(g=>g.slice(0,10));
  const clear=first.filter(r=>r.state==='clear').length;
  const signal=first.reduce((sum,r)=>{const ordered=[...r.ratios].sort((a,b)=>b-a);return sum+Math.max(0,ordered[0]-ordered[1])},0);
  return {readings,quality:clear*2+signal};
 };
 let best=detected?evaluate(detected):null;
 const shift=[-.006,-.003,0,.003,.006];
 for(const dx of shift)for(const dy of shift){
  if(!base)continue;
  const grid=base.map(rows=>rows.map(centers=>centers.map(p=>({x:p.x+dx*image.width,y:p.y+dy*image.height}))));
  const result=evaluate(grid);
  if(!best||result.quality>best.quality)best=result;
 }
 if(!best||best.readings.flatMap(g=>g.slice(0,10)).filter(r=>r.state==='clear'||r.state==='multiple').length<12)throw Error('تعذر محاذاة دوائر الإجابة بدقة كافية؛ أعد مسح الورقة');
 return best.readings;
}
export async function renderPdf(file:File,onPage:(canvas:HTMLCanvasElement,text:string,page:number,total:number)=>Promise<void>){if(file.size>50*1024*1024)throw Error('الحد الأقصى 50 ميجابايت');const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;try{if(pdf.numPages>250)throw Error('الحد الأقصى 250 صفحة');for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:1500/p.getViewport({scale:1}).width});const c=document.createElement('canvas');c.width=Math.round(v.width);c.height=Math.round(v.height);await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;const t=await p.getTextContent();await onPage(c,t.items.map((x:any)=>x.str||'').join('\n'),n,pdf.numPages);c.width=0;c.height=0;p.cleanup()}}finally{await pdf.destroy()}}
export async function decodeMeta(c:HTMLCanvasElement):Promise<SheetMeta|null>{try{const {BrowserQRCodeReader}=await import('@zxing/browser');const text=new BrowserQRCodeReader().decodeFromCanvas(c).getText();const parsed=JSON.parse(text);if(parsed.v===2&&['student','key'].includes(parsed.kind)&&['school','schoolId','name','code','gender','stage','grade'].every(k=>typeof parsed[k]==='string'&&parsed[k].length<=300)&&Array.isArray(parsed.anchors)&&parsed.anchors.length===3&&parsed.anchors.every((a:any)=>Array.isArray(a)&&a.length===3&&a.every((p:any)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=794&&p.y>=0&&p.y<=1123)))return parsed;}catch{}return null}
export function detectAnchors(image:ImageData){
const size=image.width/794*24;const map=markerTransform(image);
const inverse=(target:Point)=>{let p={x:target.x*794/image.width,y:target.y*1123/image.height};for(let i=0;i<8;i++){const q=map(p),dx=map({x:p.x+1,y:p.y}),dy=map({x:p.x,y:p.y+1});const a=dx.x-q.x,b=dy.x-q.x,c=dx.y-q.y,d=dy.y-q.y,z=a*d-b*c;if(Math.abs(z)<1e-8)throw Error('تعذر محاذاة الورقة');const ex=target.x-q.x,ey=target.y-q.y;p={x:p.x+(d*ex-b*ey)/z,y:p.y+(-c*ex+a*ey)/z}}return p};
const circles=components(image).filter(c=>c.y>image.height*.32&&c.y<image.height*.94&&c.w>size*.7&&c.w<size*1.3&&c.h>size*.7&&c.h<size*1.3&&c.w/c.h>.8&&c.w/c.h<1.25&&c.area/(c.w*c.h)>.1).map(c=>inverse(c));
const groups:Point[][]=[];for(const c of circles.sort((a,b)=>a.y-b.y)){const g=groups.find(g=>Math.abs(g.reduce((s,x)=>s+x.y,0)/g.length-c.y)<24*.45);if(g)g.push(c);else groups.push([c])}const rows=groups.filter(g=>g.length===12).sort((a,b)=>a[0].y-b[0].y);if(rows.length!==20)throw Error('تعذر التعرف على جميع دوائر الإجابة؛ راجع وضوح النموذج');const first=rows[0].sort((a,b)=>b.x-a.x),last=rows[19].sort((a,b)=>b.x-a.x);return [0,1,2].map(i=>[first[i*4],first[i*4+3],last[i*4]])}
