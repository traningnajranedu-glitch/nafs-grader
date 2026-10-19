import type {Reading} from './omr';
export type GradeBand='primary-3'|'primary-6'|'middle-3';
export function gradeBand(stage:string,grade:string):GradeBand|null{
 const text=(stage+' '+grade).normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632));
 const number=/سادس|السادس|(?:^|\D)6(?:$|\D)/.test(grade.replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)))?6:/ثالث|الثالث|(?:^|\D)3(?:$|\D)/.test(grade.replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)))?3:null;
 if(/متوسط/.test(text)&&number===3)return 'middle-3';
 if(/ابتدائ/.test(text)&&number===3)return 'primary-3';
 if(/ابتدائ/.test(text)&&number===6)return 'primary-6';
 return null;
}
export function answerCoverage(numbers:number[],readings:Reading[],decisions:Record<string,string>):string{
 if(!numbers.length||new Set(numbers).size!==numbers.length)return 'مفتاح الإجابة غير مكتمل أو مكرر';
 for(const number of numbers){
  const found=readings.filter(r=>r.questionNumber===number);
  if(found.length!==1)return 'إجابات مفقودة أو مكررة؛ يلزم إعادة القراءة';
  const r=found[0],manual=Object.prototype.hasOwnProperty.call(decisions,number);
  if(manual&&!['','A','B','C','D'].includes(decisions[number]))return 'اختيار يدوي غير صالح';
  if(!manual&&r.state!=='clear')return 'توجد إجابات غير مؤكدة أو فارغة تحتاج مراجعة';
  if(!manual&&!['A','B','C','D'].includes(r.selected||''))return 'إجابة واضحة بلا اختيار صالح';
 }
 return '';
}
