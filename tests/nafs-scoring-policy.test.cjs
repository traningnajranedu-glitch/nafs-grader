const assert=require('node:assert/strict');
const {scoreAnswer}=require('../scripts/nafs-scoring-policy.cjs');
const key='B';
for(const state of ['blank','multiple']){
 const result=scoreAnswer({state,choice:null},key);
 assert.equal(result.points,0);assert.equal(result.status,'scored');
}
assert.equal(scoreAnswer({state:'uncertain',choice:'B'},key).points,null);
assert.equal(scoreAnswer({state:'uncertain',choice:'B'},key,true).points,0);
assert.equal(scoreAnswer({state:'clear',choice:'B'},key).points,1);
assert.equal(scoreAnswer({state:'clear',choice:'A'},key).points,0);
assert.equal(scoreAnswer({state:'blank'},null).status,'review');
console.log('NAFS scoring policy: 7 assertions passed');
