const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
function route(path,{admin=true,folder={mimeType:'application/vnd.google-apps.folder',name:'ملفات المدارس'},ok=true}={}){
 const calls=[],m={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const requireMock=id=>id==='next/server'?{NextResponse:{json:(body,init={})=>({body,status:init.status||200})}}:{
  requireAdmin:async()=>{if(!admin)throw Error('Login required')},driveToken:async()=>'test-token',
  serviceDb:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{updated_at:'today'}})})})})})
 };
 const fetchMock=async(url,options)=>{calls.push({url,options});return {ok,json:async()=>folder}};
 new Function('exports','module','require','fetch',source)(m.exports,m,requireMock,fetchMock);
 return {api:m.exports,calls};
}
const req={headers:{get:()=>null}};
(async()=>{
 const old=process.env.GOOGLE_DRIVE_INPUT_FOLDER_ID;
 try{
  process.env.GOOGLE_DRIVE_INPUT_FOLDER_ID='configured-folder';
  for(const [path,method] of [['app/api/google/folder/route.ts','POST'],['app/api/google/status/route.ts','GET']]){
   const good=route(path),response=await good.api[method](req);
   assert.equal(response.status,200);
   assert.equal(response.body.url||response.body.folderUrl,'https://drive.google.com/drive/folders/configured-folder');
   assert.equal(good.calls.length,1);assert.ok(good.calls[0].url.includes('/configured-folder?'));
   assert.equal(good.calls[0].options.method,undefined);
   const denied=route(path,{admin:false});assert.equal((await denied.api[method](req)).status,403);assert.equal(denied.calls.length,0);
   for(const folder of [{trashed:true,mimeType:'application/vnd.google-apps.folder'},{mimeType:'application/pdf'}]){
    const invalid=await route(path,{folder}).api[method](req);
    assert.ok(invalid.status===403||invalid.body.folderAccess===false);assert.ok(!invalid.body.url&&!invalid.body.folderUrl);
   }
  }
  delete process.env.GOOGLE_DRIVE_INPUT_FOLDER_ID;
  const missing=route('app/api/google/folder/route.ts');assert.equal((await missing.api.POST(req)).status,403);assert.equal(missing.calls.length,0);
  console.log('PASS: configured Drive folder consistency, no duplicate creation, auth and folder validation');
 }finally{if(old===undefined)delete process.env.GOOGLE_DRIVE_INPUT_FOLDER_ID;else process.env.GOOGLE_DRIVE_INPUT_FOLDER_ID=old}
})().catch(error=>{console.error(error);process.exitCode=1});
