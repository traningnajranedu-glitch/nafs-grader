const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
let authorized=true,rpcArgs,fail=false;
const db={rpc:async(name,args)=>{assert.equal(name,'nafs_verified_analytics');rpcArgs=args;return fail?{error:Error('test failure')}:{data:{summary:{verified:7}}}}};
const m={exports:{}};
new Function('exports','module','require',ts.transpileModule(fs.readFileSync('app/api/results/analytics/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,m,(name)=>name==='../../../../lib/google-drive-server'?{requireAdmin:async()=>{if(!authorized)throw Error('unauthorized')},serviceDb:()=>db}:require(name));
const {NextRequest}=require('next/server');
(async()=>{
 const req=p=>new NextRequest('http://localhost/api/results/analytics'+p);
 authorized=false;assert.equal((await m.exports.GET(req(''))).status,401);assert.equal(rpcArgs,undefined);
 authorized=true;assert.equal((await m.exports.GET(req('?stage=primary6'))).status,400);assert.equal(rpcArgs,undefined);
 const r=await m.exports.GET(req('?stage=middle3&gender='+encodeURIComponent('بنات')+'&school='+encodeURIComponent('مدرسة اختبار')+'&subject=math&skill=M1'));
 assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(rpcArgs,{p_stage:'middle3',p_gender:'بنات',p_school:'مدرسة اختبار',p_subject:'math',p_skill:'M1'});
 fail=true;const old=console.error;console.error=()=>{};assert.equal((await m.exports.GET(req(''))).status,500);console.error=old;
 console.log('PASS: analytics admin gate, sixth-grade exclusion, filter forwarding, no-store and safe failure');
})().catch(e=>{console.error(e);process.exit(1)});
