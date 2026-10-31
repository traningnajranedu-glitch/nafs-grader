'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
type Digits='arab'|'latn';
const arabic='٠١٢٣٤٥٦٧٨٩';
export function convertDigits(value:string|number,mode:Digits){return String(value).replace(/[٠-٩۰-۹0-9]/g,char=>{const code=char.charCodeAt(0),n=code>=1776?code-1776:code>=1632?code-1632:code-48;return mode==='arab'?arabic[n]:String(n)})}
const NumberContext=createContext<{mode:Digits;format:(v:string|number)=>string;toggle:()=>void}>({mode:'arab',format:v=>convertDigits(v,'arab'),toggle:()=>{}});
export function NumberProvider({children}:{children:ReactNode}){
 const [mode,setMode]=useState<Digits>('arab');
 useEffect(()=>{try{const saved=localStorage.getItem('nafs-number-digits');if(saved==='arab'||saved==='latn')setMode(saved)}catch{}},[]);
 const toggle=()=>setMode(previous=>{const next=previous==='arab'?'latn':'arab';try{localStorage.setItem('nafs-number-digits',next)}catch{}return next});
 return <NumberContext.Provider value={{mode,format:value=>convertDigits(value,mode),toggle}}>{children}</NumberContext.Provider>
}
export const useNumbers=()=>useContext(NumberContext);
