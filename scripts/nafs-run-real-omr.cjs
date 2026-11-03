// Execute the repository's actual readLegacy() on a grayscale page raster.
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),path=require('node:path');
const cache={};
function load(file){
 const name=path.resolve(file);if(cache[name])return cache[name].exports;
 const source=fs.readFileSync(name,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const module={exports:{}};cache[name]=module;
 const localRequire=(id)=>id.startsWith('.')?load(path.resolve(path.dirname(name),id+'.ts')):require(id);
 vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{console,Uint8Array,Math,Error,Array,Map,Set,Number,Boolean,String,Promise,ImageData:undefined})(localRequire,module,module.exports);
 return module.exports;
}
const {readLegacy}=load('lib/auto-omr.ts');
const file=process.argv[2],width=Number(process.argv[3]),height=Number(process.argv[4]);
const gray=fs.readFileSync(file);if(gray.length!==width*height)throw Error('Invalid raster size');
const data=new Uint8ClampedArray(gray.length*4);
for(let i=0;i<gray.length;i++){data[i*4]=gray[i];data[i*4+1]=gray[i];data[i*4+2]=gray[i];data[i*4+3]=255}
const subjects=readLegacy({width,height,data});
process.stdout.write(JSON.stringify({subjects:subjects.map(rows=>({total:rows.length,clear:rows.filter(x=>x.state==='clear').length,blank:rows.filter(x=>x.state==='blank').length,multiple:rows.filter(x=>x.state==='multiple').length,uncertain:rows.filter(x=>x.state==='uncertain').length}))}));
