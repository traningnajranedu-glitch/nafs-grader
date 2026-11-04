const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
let rpcCalls=[],fail=false;
const fixtures={
 primary3:{schools:[{stage:'primary3',school:'مدرسة ابتدائي'}],questions:[],subjects:[{stage:'primary3',subject:'arabic',responses:10,correct:7,percent:70}],skills:[{stage:'primary3',subject:'arabic',skill_code:'K1',skill_name:'مهارة 1'}],genders:[{gender:'بنات',students:3,percent:60}],summary:{students:10,verified:7,excluded:3,missing:2,included:7,percent:70,coverage:70,invalidVerified:1,unmappedQuestions:2},stages:[{stage:'primary3',students:10,verified:7,missing:2}],checkedAt:'2026-11-04T00:00:00Z',thresholdNote:'test'},
 primary6:{schools:[{stage:'primary6',school:'مدرسة سادس'}],questions:[],subjects:[{stage:'primary6',subject:'science',responses:5,correct:2,percent:40}],skills:[],genders:[{gender:'بنين',students:2,percent:50}],summary:{students:5,verified:2,excluded:3,missing:1,included:2,percent:40,coverage:40,invalidVerified:0,unmappedQuestions:0},stages:[{stage:'primary6',students:5,verified:2,missing:1}],checkedAt:'2026-11-04T00:00:01Z',thresholdNote:'test'},
 middle3:{schools:[{stage:'middle3',school:'مدرسة متوسطة'}],questions:[],subjects:[{stage:'middle3',subject:'science',responses:20,correct:10,percent:50}],skills:[],genders:[{gender:'بنات',students:4,percent:50}],summary:{students:20,verified:8,excluded:12,missing:5,included:8,percent:50,coverage:40,invalidVerified:2,unmappedQuestions:3},stages:[{stage:'middle3',students:20,verified:8,missing:5}],checkedAt:'2026-11-04T00:00:02Z',thresholdNote:'test'}
};
const db={rpc:async(name,args)=>{assert.equal(name,'nafs_verified_analytics');rpcCalls.push(args);return fail?{error:Error('test failure')}:{data:fixtures[args.p_stage]}}};
const m={exports:{}};
new Function('exports','module','require',ts.transpileModule(fs.readFileSync('app/api/results/analytics/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,m,(name)=>name==='../../../../lib/google-drive-server'?{serviceDb:()=>db}:require(name));
const {NextRequest}=require('next/server');
(async()=>{
 const req=p=>new NextRequest('http://localhost/api/results/analytics'+p);
 rpcCalls=[];const all=await m.exports.GET(req(''));assert.equal(all.status,200);
 const body=await all.json();assert.deepEqual(body.summary,{students:35,verified:17,excluded:18,missing:8,included:17,percent:(70*7+40*2+50*8)/17,coverage:100*17/35,invalidVerified:3,unmappedQuestions:5});
 assert.deepEqual(rpcCalls.map(x=>x.p_stage),['primary3','primary6','middle3']);
 assert.ok(Array.isArray(body.options.schools));assert.ok(Array.isArray(body.genders));
 rpcCalls=[];assert.equal((await m.exports.GET(req('?stage=invalid'))).status,400);assert.equal(rpcCalls.length,0);
 const sixth=await m.exports.GET(req('?stage=primary6&subject=science'));assert.equal(sixth.status,200);
 assert.deepEqual(rpcCalls.at(-1),{p_stage:'primary6',p_gender:null,p_school:null,p_subject:'science',p_skill:null});
 rpcCalls=[];const filtered=await m.exports.GET(req('?stage=middle3&gender='+encodeURIComponent('بنات')+'&school='+encodeURIComponent('مدرسة اختبار')+'&subject=science&skill=M1'));
 assert.equal(filtered.status,200);assert.equal(filtered.headers.get('Cache-Control'),'private, no-store');
 assert.deepEqual(rpcCalls.at(-1),{p_stage:'middle3',p_gender:'بنات',p_school:'مدرسة اختبار',p_subject:'science',p_skill:'M1'});
 fail=true;const old=console.error;console.error=()=>{};assert.equal((await m.exports.GET(req(''))).status,500);console.error=old;
 console.log('PASS: three-stage analytics aggregation including sixth primary, weighted metrics, filters, no-store and safe failure');
})().catch(e=>{console.error(e);process.exit(1)});
