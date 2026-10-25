const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {createCanvas}=require('@napi-rs/canvas');
function compile(path,requires={}){const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(n=>requires[n]||require(n),m.exports,m);return m.exports}
const omr=compile('lib/omr.ts'),auto=compile('lib/auto-omr.ts',{'./omr':omr});
function sheet({scale=1,angle=0,gaps=true,missingRow=-1,blank=false}={}){
 const w=Math.round(1400*scale),h=Math.round(2000*scale),c=createCanvas(w,h),ctx=c.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.translate(w/2,h/2);ctx.rotate(angle);ctx.scale(scale,scale);ctx.translate(-700,-1000);
 for(let g=0;g<3;g++)for(let q=0;q<20;q++){
  if(q===missingRow)continue;
  for(let o=0;o<4;o++){
   const x=310+g*350+o*38,y=630+q*43+(gaps?Math.floor(q/5)*18:0);
   ctx.strokeStyle='#222';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.stroke();
   if(!blank&&o===3-q%4){ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x,y,13.5,0,Math.PI*2);ctx.fill()}
  }
 }
 return ctx.getImageData(0,0,w,h);
}
for(const options of [{},{gaps:false},{scale:.75},{scale:1.3},{angle:.045},{angle:-.045}]){
 const rows=auto.readLegacy(sheet(options));assert.equal(rows.length,3);assert.ok(rows.every(g=>g.length===20));
 assert.ok(rows.every(g=>g.every((r,i)=>r.state==='clear'&&r.selected==='ABCD'[i%4])),JSON.stringify(options));
}
assert.ok(auto.readLegacy(sheet({blank:true})).flat().every(r=>r.state==='blank'));
assert.throws(()=>auto.readLegacy(sheet({missingRow:6})),/الأسئلة العشرين/);
const empty=createCanvas(1400,2000);empty.getContext('2d').fillStyle='#fff';empty.getContext('2d').fillRect(0,0,1400,2000);
assert.throws(()=>auto.readLegacy(empty.getContext('2d').getImageData(0,0,1400,2000)));
assert.equal(omr.classifyHybrid([.95,.4,.05,.05],[.96,.5,.06,.06],1).state,'multiple');
assert.equal(omr.classifyHybrid([.95,.24,.05,.05],[.96,.3,.06,.06],1).state,'uncertain');
assert.notEqual(omr.classifyHybrid([.40,.03,.04,.03],[.65,.05,.06,.05],1).state,'clear');
assert.equal(omr.classifyHybrid([.08,.85,.06,.03],[.1,.9,.08,.04],1).state,'clear');
assert.equal(omr.classifyHybrid([.95,.1,.05,.04],[.96,.12,.8,.05],1).state,'uncertain');
console.log('PASS: adaptive scale, gaps, skew, all-blank sheets, missing-row rejection and secondary marks');
