import type {ReactNode} from 'react';
const icons:Record<string,ReactNode>={
support:<><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v6h4v-6H4Zm16 0h2v6h-4v-6h2Zm0 6a4 4 0 0 1-4 4h-4"/></>,
exams:<><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 10h6M9 14h6"/></>,
key:<><path d="M4 4h16v16H4zM8 10h8M8 14h8"/></>,
students:<><circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
omr:<><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="12" r="2"/></>,
results:<><path d="M5 3h14v18H5zM9 8h6M9 12h6M9 16h3"/></>,
kpi:<><path d="M4 20V12M10 20V7M16 20V4M22 20H2"/></>,
school:<><path d="M3 21V8l9-5 9 5v13M3 21h18M9 21v-7h6v7"/></>
};
export function UiIcon({name,size=20}:{name:string;size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]||icons.exams}</svg>}

