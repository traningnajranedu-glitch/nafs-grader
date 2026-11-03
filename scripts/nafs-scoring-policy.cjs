'use strict';
// A faint mark may be scored zero only when its faintness has been
// independently confirmed. Otherwise uncertain remains review-only.
function scoreAnswer(reading,correct,confirmedFaint=false){
 if(!reading||!['A','B','C','D'].includes(correct))return {points:null,status:'review',reason:'missing_or_invalid_key'};
 if(reading.state==='blank'||reading.state==='multiple')return {points:0,status:'scored',reason:reading.state};
 if(reading.state==='uncertain'){
  if(confirmedFaint===true)return {points:0,status:'scored',reason:'confirmed_faint'};
  return {points:null,status:'review',reason:'uncertain_mark'};
 }
 if(reading.state==='clear'&&['A','B','C','D'].includes(reading.choice))
  return {points:Number(reading.choice===correct),status:'scored',reason:'clear_mark'};
 return {points:null,status:'review',reason:'invalid_reading'};
}
module.exports={scoreAnswer};
