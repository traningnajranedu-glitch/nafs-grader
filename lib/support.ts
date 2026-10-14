import {supabase} from './supabase';
export const SUPPORT_STATUSES={new:'جديد',in_progress:'قيد المعالجة',waiting_school:'بانتظار رد المدرسة',resolved:'تم الحل',closed:'مغلق'} as const;
export const SUPPORT_PRIORITIES={normal:'عادية',high:'مرتفعة',urgent:'عاجلة'} as const;
export const SUPPORT_SERVICES=['استيراد الطلاب','إصدار PDF','طباعة النماذج','أخرى'];
export const SUPPORT_KINDS=['مشكلة تقنية','مشكلة بيانات','استفسار','اقتراح'];
export type SupportStatus=keyof typeof SUPPORT_STATUSES;
export type SupportPriority=keyof typeof SUPPORT_PRIORITIES;
export type SupportSchool={id:string;name:string;gender?:string|null;stage?:string|null};
export type SupportTicket={id:string;number:number;school_id:string;reporter_name:string;phone:string;service:string;kind:string;title:string;status:SupportStatus;priority:SupportPriority;resolution:string;rating:number|null;created_at:string;updated_at:string;schools:Omit<SupportSchool,'id'>};
export type SupportMessage={id:string;author_role:'school'|'admin';internal:boolean;body:string;attachment_name:string|null;attachment_url:string|null;status_change:SupportStatus|null;created_at:string};
export type SupportDetail={ticket:SupportTicket;messages:SupportMessage[]};
export type SupportCredential={ticket:string;secret:string;school:string};
const STORAGE_KEY='nafs-support-v1';
export function newCredential(school:string):SupportCredential{return {ticket:crypto.randomUUID(),secret:Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join(''),school}}
export function readCredentials():SupportCredential[]{try{const items=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(items)?items.filter(x=>x&&typeof x.ticket==='string'&&typeof x.school==='string'&&/^[a-f0-9]{64}$/.test(x.secret)).slice(-100):[]}catch{return []}}
export function saveCredential(value:SupportCredential){const all=readCredentials().filter(x=>x.ticket!==value.ticket);localStorage.setItem(STORAGE_KEY,JSON.stringify([...all,value].slice(-100)))}
export function trackingCode(c:SupportCredential){return c.ticket+'.'+c.secret}
export function parseTrackingCode(value:string,school:string):SupportCredential|null{const [ticket,secret,...rest]=value.trim().split('.');return !rest.length&&/^[0-9a-f-]{36}$/i.test(ticket||'')&&/^[0-9a-f]{64}$/.test(secret||'')?{ticket,secret,school}:null}
export function supportDate(value:string){return new Date(value).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'})}
export async function supportApi<T>(body:Record<string,unknown>):Promise<T>{if(!supabase)throw Error('الاتصال غير متاح');const r=await supabase.functions.invoke('school-support',{body});if(r.error){let message='تعذر الاتصال بخدمة البلاغات؛ حاول مجددًا';try{const json=await r.error.context?.json();if(typeof json?.error==='string')message=json.error}catch{}throw Error(message)}if(r.data?.error)throw Error(r.data.error);return r.data as T}
export async function supportAttachment(file:File|null){if(!file)return undefined;if(file.size>5242880)throw Error('حجم المرفق الأقصى 5 ميجابايت');if(!['image/png','image/jpeg','application/pdf'].includes(file.type))throw Error('اختر صورة PNG أو JPG أو ملف PDF');return new Promise<{name:string;data:string}>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('تعذر قراءة المرفق'));reader.onload=()=>resolve({name:file.name,data:String(reader.result).split(',')[1]});reader.readAsDataURL(file)})}
