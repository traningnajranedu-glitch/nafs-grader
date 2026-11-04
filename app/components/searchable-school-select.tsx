'use client';
import {useId,useMemo,useState} from 'react';

export type SchoolSearchOption={value:string;label:string;description?:string};
type Props={options:SchoolSearchOption[];value:string;onChange:(value:string)=>void;placeholder?:string;disabled?:boolean;style?:React.CSSProperties;className?:string;emptyLabel?:string;};

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\s\u200f\u200e]+/g,' ').trim().toLocaleLowerCase('ar');

export default function SearchableSchoolSelect({options,value,onChange,placeholder='اكتب اسم المدرسة للبحث...',disabled=false,style,className,emptyLabel='لا توجد مدارس مطابقة'}:Props){
 const listId=useId();
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(0);
 const selected=options.find(option=>option.value===value);
 const filtered=useMemo(()=>{const q=normalize(query);if(!q)return options;return options.filter(option=>normalize(option.label+' '+(option.description||'')).includes(q));},[options,query]);
 const choose=(option:SchoolSearchOption)=>{onChange(option.value);setQuery('');setOpen(false);setActive(0);};
 const inputValue=open?query:(selected?.label||'');
 return <div className={'school-search '+(className||'')} style={{position:'relative',width:'100%',minWidth:0}}>
  <div style={{position:'relative'}}>
   <input type="text" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} autoComplete="off" disabled={disabled} value={inputValue} placeholder={placeholder} onFocus={()=>{setQuery('');setOpen(true);setActive(0)}} onChange={event=>{setQuery(event.target.value);setOpen(true);setActive(0)}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setActive(i=>Math.min(i+1,Math.max(filtered.length-1,0)));}else if(event.key==='ArrowUp'){event.preventDefault();setActive(i=>Math.max(0,i-1));}else if(event.key==='Enter'&&open&&filtered[active]){event.preventDefault();choose(filtered[active]);}else if(event.key==='Escape'){setOpen(false);setQuery('');}}} onBlur={()=>{setOpen(false);setQuery('')}} style={{width:'100%',boxSizing:'border-box',padding:'12px 40px 12px 38px',border:'1px solid #94a3b8',borderRadius:11,background:'inherit',color:'inherit',font:'inherit',outlineOffset:2,...style}}/>
   <span aria-hidden="true" style={{position:'absolute',right:13,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',opacity:.7}}>⌕</span>
   {value&&!disabled&&<button type="button" aria-label="مسح اختيار المدرسة" onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange('');setQuery('');setOpen(true)}} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',border:0,background:'transparent',color:'inherit',cursor:'pointer',fontSize:18}}>×</button>}
  </div>
  {open&&!disabled&&<div id={listId} role="listbox" style={{position:'absolute',zIndex:1000,top:'calc(100% + 5px)',right:0,left:0,maxHeight:260,overflowY:'auto',border:'1px solid var(--border, #d5e0e6)',borderRadius:12,background:'var(--bg, #f3f7f9)',color:'var(--navy, #17364a)',boxShadow:'0 12px 30px #16344b18',padding:5}}>
   {filtered.length?filtered.slice(0,100).map((option,index)=><button type="button" role="option" aria-selected={option.value===value} key={option.value+'-'+option.label+'-'+index} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)} onMouseEnter={()=>setActive(index)} style={{display:'block',width:'100%',textAlign:'right',padding:'10px 12px',border:0,borderRadius:8,background:index===active?'var(--mint, #e8f5f2)':option.value===value?'#dcefeb':'transparent',color:'var(--navy, #17364a)',cursor:'pointer',font:'inherit'}}>
    <span style={{display:'block',fontWeight:700}}>{option.label}</span>{option.description&&<small style={{display:'block',marginTop:3,color:'var(--muted, #64748b)'}}>{option.description}</small>}
   </button>):<div style={{padding:14,textAlign:'center',color:'var(--muted, #64748b)'}}>{emptyLabel}</div>}
   {filtered.length>100&&<div style={{padding:'7px 12px',fontSize:12,color:'#64748b'}}>اكتب مزيدًا من اسم المدرسة لتضييق النتائج ({filtered.length} نتيجة)</div>}
  </div>}
 </div>;
}
