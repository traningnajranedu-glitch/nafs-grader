const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
let uploaded;
const records=[{id:'public',internal:false,attachment_path:'ticket/image.png',attachment_name:'test.png'},{id:'private',internal:true,attachment_path:null}];
const db={
 storage:{from:bucket=>({upload:async(path,bytes,options)=>{uploaded={bucket,path,bytes,options};return {error:null}},createSignedUrl:async(path,seconds)=>({data:{signedUrl:'https://example.test/signed?expires='+seconds},error:null})})},
 from:table=>{assert.equal(table,'support_messages');const filters=[];const query={select:()=>query,eq:(k,v)=>{filters.push([k,v]);return query},order:()=>query,then:resolve=>resolve({data:records.filter(m=>filters.every(([k,v])=>k==='ticket_id'||m[k]===v)),error:null})};return query}
};
const source=fs.readFileSync('supabase/functions/school-support/index.ts','utf8').replace(/^import .*;\n/,'');
const compiled=ts.transpileModule(source+'\nglobalThis.helpers={attachment,detail};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={createClient:()=>db,Deno:{env:{get:()=> 'test-only'},serve:()=>{}},console,crypto:globalThis.crypto,TextEncoder,TextDecoder,Uint8Array,atob,Response,Request};
vm.createContext(context);vm.runInContext(compiled,context);
(async()=>{
 const {attachment,detail}=context.helpers;
 await assert.rejects(()=>attachment({name:'test.exe',data:Buffer.from('MZ executable').toString('base64')},'t','m'),/PNG/);
 await assert.rejects(()=>attachment({name:'big.pdf',data:'a'.repeat(7000001)},'t','m'),/5/);
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKXkAAAAASUVORK5CYII=','base64');
 const file=await attachment({name:'test.png',data:bytes.toString('base64')},'ticket','message');
 assert.equal(file.attachment_path,'ticket/message.png');assert.equal(uploaded.bucket,'support-attachments');assert.deepEqual(Buffer.from(uploaded.bytes),bytes);assert.equal(uploaded.options.contentType,'image/png');assert.equal(uploaded.options.upsert,false);
 const school=await detail({id:'ticket'},false);assert.equal(school.messages.length,1);assert.equal(school.messages[0].attachment_path,undefined);assert.match(school.messages[0].attachment_url,/expires=600/);
 const admin=await detail({id:'ticket'},true);assert.equal(admin.messages.length,2);
 console.log('PASS: attachment validation, exact bytes, private storage, expiring links and hidden internal notes');
})().catch(e=>{console.error(e);process.exitCode=1});
