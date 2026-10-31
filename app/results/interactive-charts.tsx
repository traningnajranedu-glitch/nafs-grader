'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';

import {useNumbers} from './number-format';
const percent=(v:number|null)=>v===null?'—':v.toFixed(1)+'%';
const clamp=(v:number)=>Math.max(0,Math.min(100,v));
const subjectColors:Record<string,string>={arabic:'#35e5c2',math:'#62bcff',science:'#f4d28d'};

function useAnimatedValue(value:number|null){
 const [display,setDisplay]=useState(value),current=useRef(value);
 useEffect(()=>{
  if(value===null||current.current===null||window.matchMedia('(prefers-reduced-motion: reduce)').matches){current.current=value;setDisplay(value);return;}
  const from=current.current,start=performance.now();let frame=0;
  const step=(now:number)=>{const progress=Math.min(1,(now-start)/750),next=from+(value-from)*(1-Math.pow(1-progress,3));current.current=next;setDisplay(next);if(progress<1)frame=requestAnimationFrame(step)};
  frame=requestAnimationFrame(step);return()=>cancelAnimationFrame(frame);
 },[value]);return display;
}
export function AnimatedPercent({value}:{value:number|null}){const {format:f}=useNumbers();return <>{f(percent(useAnimatedValue(value)))}</>}

export function MasteryRing({value,label,subject,hint}:{value:number|null;label:string;subject:string;hint?:string}){
 const {format:f}=useNumbers();
 const [expanded,setExpanded]=useState(false);
 return <div className="ic-ring-wrap"><button type="button" className="ic-ring-button" aria-expanded={expanded} aria-label={label+' — '+percent(value)+(hint?' — '+hint:'')} onClick={()=>setExpanded(v=>!v)} style={{'--series':subjectColors[subject]||'#35e5c2'} as CSSProperties}>
 <svg viewBox="0 0 140 140" aria-hidden="true"><circle className="ic-ring-track" cx="70" cy="70" r="53" strokeWidth="8"/><circle className="ic-ring-progress" cx="70" cy="70" r="53" strokeWidth="8" strokeDasharray={333.009} strokeDashoffset={333.009*(1-clamp(value??0)/100)}/><text x="70" y="77" textAnchor="middle"><AnimatedPercent value={value}/></text></svg><span className="ic-ring-label">{f(label)}</span></button>
 <small className={'ic-ring-detail'+(expanded?' is-expanded':'')}>{f(hint||'نسبة الإجابات الصحيحة')}</small></div>
}
type BarItem={label:string;value:number|null;hint?:string;onSelect?:()=>void};
export function InteractiveBars({items}:{items:BarItem[]}){
 const {format:f}=useNumbers();
 const [selected,setSelected]=useState<string|null>(null);
 const selection=items.find(x=>x.label===selected);
 return <div className="ic-bars"><div className="ic-bar-list">{items.map(x=><button type="button" key={x.label} className="ic-bar-row" aria-pressed={selected===x.label} aria-label={x.label+' — '+percent(x.value)+(x.hint?' — '+x.hint:'')} onClick={()=>{setSelected(x.label);x.onSelect?.()}}>
 <span className="ic-bar-label"><span>{f(x.label)}</span><b><AnimatedPercent value={x.value}/></b></span><span className="ic-track"><span className="ic-fill" style={{width:clamp(x.value??0)+'%'}}/></span>{x.hint&&<small>{f(x.hint)}</small>}</button>)}</div>
 {items.length>0&&<div className="ic-axis" aria-hidden="true"><span>{f('0%')}</span><span>{f('50%')}</span><span>{f('100%')}</span></div>}
 {selection&&<p className="ic-selection" aria-live="polite">{f(selection.label+' · '+percent(selection.value)+(selection.hint?' · '+selection.hint:''))}</p>}</div>
}
const categories=['سهل','متوسط','صعب'],difficultyColors=['#35e5c2','#f4d28d','#f19ab2'];
export function DifficultyChart({label,counts}:{label:string;counts:number[]}){
 const {format:f}=useNumbers();
 const [selected,setSelected]=useState<number|null>(null),total=counts.reduce((a,b)=>a+b,0);
 return <div className="ic-difficulty"><b>{label}</b><div className="ic-stack" role="group" aria-label={'صعوبة أسئلة '+label}>{counts.map((count,i)=><button type="button" key={categories[i]} disabled={!count} aria-pressed={selected===i} aria-label={categories[i]+': '+count+' من '+total+' سؤالًا'} onClick={()=>setSelected(i)} style={{width:(total?100*count/total:0)+'%',background:difficultyColors[i]}}>{count>0?f(Math.round(100*count/total)+'%'):''}</button>)}</div><small>{total?f(total+' سؤالًا محللًا'):'لا توجد أسئلة موثقة في هذا النطاق'}</small>{selected!==null&&<p className="ic-selection" aria-live="polite">{categories[selected]} · {f(counts[selected])} من {f(total)} سؤالًا {total?f('('+percent(100*counts[selected]/total)+')'):''}</p>}</div>
}
export function ChartStyles(){return <style>{`
 .results .ic-bars{min-width:0}.ic-bar-list{display:grid;gap:14px}.results .ic-bar-row{display:block;width:100%;padding:8px 0;background:transparent;border:0;border-radius:6px;text-align:right;color:inherit}.results .ic-bar-row:hover,.results .ic-bar-row[aria-pressed=true]{background:transparent}.ic-bar-label{display:flex;gap:16px;justify-content:space-between;align-items:start;margin-bottom:9px;font-size:14px}.ic-bar-label>span{overflow-wrap:anywhere}.ic-bar-label b{white-space:nowrap;font-weight:500;font-variant-numeric:tabular-nums;direction:ltr}.ic-track{display:block;height:13px;background:#ffffff12;border-radius:12px;overflow:hidden}.ic-fill{display:block;height:100%;background:linear-gradient(90deg,#148da4,#3be5c5);border-radius:12px;transition:width .8s cubic-bezier(.22,1,.36,1),filter .2s}.ic-bar-row:hover .ic-fill,.ic-bar-row:focus-visible .ic-fill,.ic-bar-row[aria-pressed=true] .ic-fill{filter:brightness(1.3);box-shadow:0 0 12px #35e5c277}.ic-bar-row small{font-size:12px;color:#bbdce7}.ic-axis{display:flex;justify-content:space-between;font-size:11px;color:#b4d9e4;margin-top:10px}.results .ic-selection{font-size:12px;color:#f4d28d;margin:12px 0 0;overflow-wrap:anywhere}.results .ic-ring-button{padding:0 2px;display:block;width:100%;border:0;background:transparent;color:#e9f9fb;border-radius:12px}.results .ic-ring-button:hover,.results .ic-ring-button[aria-expanded=true]{background:transparent}.ic-ring-wrap{text-align:center;flex:1 1 90px;max-width:150px;min-width:0}.ic-ring-button svg{display:block;width:100%;max-width:130px;overflow:visible;margin:auto}.ic-ring-track{fill:none;stroke:#ffffff12}.ic-ring-progress{fill:none;stroke:var(--series);stroke-linecap:round;transform:rotate(-90deg);transform-origin:70px 70px;transition:stroke-dashoffset .8s cubic-bezier(.22,1,.36,1),filter .2s;filter:drop-shadow(0 0 5px #35e5c233)}.ic-ring-button:hover .ic-ring-progress,.ic-ring-button:focus-visible .ic-ring-progress,.ic-ring-button[aria-expanded=true] .ic-ring-progress{stroke-width:10;filter:drop-shadow(0 0 7px var(--series))}.ic-ring-button text{fill:#e9f9fb;font:600 21px system-ui;direction:ltr;font-variant-numeric:tabular-nums}.ic-ring-label{display:block;margin-top:7px;font-size:14px}.results .ic-ring-detail{font-size:11px;margin-top:6px;opacity:0;min-height:32px;overflow-wrap:anywhere}.ic-ring-wrap:hover .ic-ring-detail,.ic-ring-wrap:focus-within .ic-ring-detail,.results .ic-ring-detail.is-expanded{opacity:1}.ic-difficulty{margin-top:17px;display:grid;grid-template-columns:65px minmax(0,1fr);align-items:center;gap:8px;font-size:13px}.ic-stack{display:flex;gap:3px;min-height:36px;border-radius:9px;overflow:hidden;background:#ffffff0c}.results .ic-stack button{border:0;border-radius:0;padding:8px 0;min-width:0;color:#042d3c;font-size:12px;white-space:nowrap;overflow:hidden;transition:width .8s cubic-bezier(.22,1,.36,1),filter .2s}.results .ic-stack button:hover,.results .ic-stack button[aria-pressed=true]{color:#042d3c;filter:brightness(1.18)}.ic-difficulty>small,.ic-difficulty>.ic-selection{grid-column:2;margin:0}.results .pd-rings{gap:9px}.results .pd-stages{grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr))}.results .chart-stale{opacity:.45;pointer-events:none}
 @media(pointer:coarse){.results .ic-bar-row{min-height:44px}.ic-stack{min-height:44px}.results .ic-ring-detail{opacity:1}}
 @media(prefers-reduced-motion:reduce){.results .ic-fill,.results .ic-ring-progress,.results .ic-stack button{transition:none}}
 @media print{.results .ic-bar-row,.results .ic-ring-button{background:transparent!important;color:#143c50!important}.ic-ring-button text{fill:#143c50}.ic-ring-progress,.ic-fill,.ic-stack button{print-color-adjust:exact;filter:none!important}.ic-ring-track{stroke:#dce7ed}.ic-track{background:#e8f0f2}.results .ic-ring-detail{opacity:1;color:#143c50!important}.results .ic-axis,.results .ic-selection{color:#143c50}.ic-selection{display:none}.results .ic-ring-button svg{max-width:110px}}
 `}</style>}
