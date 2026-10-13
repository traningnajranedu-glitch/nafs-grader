import type {Reading} from './omr';
export const SUBJECTS=['لغتي','الرياضيات','العلوم'] as const;
export const ALL_SUBJECTS='جميع المواد';
export const canonicalSubject=(subject:string)=>subject==='القراءة'?'لغتي':subject;
export const isCombined=(subject:string)=>subject===ALL_SUBJECTS;
export const questionCount=(subject:string)=>isCombined(subject)?60:20;
export function questionLabel(subject:string,n:number){const index=isCombined(subject)?Math.floor((n-1)/20):SUBJECTS.indexOf(canonicalSubject(subject) as typeof SUBJECTS[number]);return {subject:SUBJECTS[index]||subject,number:isCombined(subject)?(n-1)%20+1:n}}
export function readingsForExam(subject:string,groups:Reading[][]){if(isCombined(subject))return groups.flatMap((rs,i)=>rs.map(r=>({...r,questionNumber:r.questionNumber+i*20})));return groups[SUBJECTS.indexOf(canonicalSubject(subject) as typeof SUBJECTS[number])]||[]}
