import test from 'node:test';
import assert from 'node:assert/strict';
import {boundCurtain,canCompareRegions,curtainSide,verifiedFinds,readPlayDraft,recipeInput,classRecipes} from '../src/lib/exploration.ts';
import {classDefaults} from '../src/lib/classification.ts';

const a={fingerprint:'same-data',parameters:{dataset:'moons'},region:{bounds:[-3,3,-3,3]},metrics:{validation_accuracy:.8}};
test('A/B permits different models on the same evidence and rejects changed data or axes',()=>{
  assert.equal(canCompareRegions(a,{...a,parameters:{dataset:'moons',model:'svm'},metrics:{validation_accuracy:.9}}),true);
  assert.equal(canCompareRegions(a,{...a,fingerprint:'other-data'}),false);
  assert.equal(canCompareRegions(a,{...a,parameters:{dataset:'iris'}}),false);
  assert.equal(canCompareRegions(a,{...a,region:{bounds:[-2,3,-3,3]}}),false);
  assert.equal(canCompareRegions(null,a),false);
});
test('curtain endpoints show one model and the point exactly at the divider belongs to B',()=>{
  assert.equal(curtainSide(0,[-3,3,-3,3],.5),'B');
  assert.equal(curtainSide(-1,[-3,3,-3,3],.5),'A');
  assert.equal(curtainSide(1,[-3,3,-3,3],0),'B');
  assert.equal(curtainSide(1,[-3,3,-3,3],1),'A');
  assert.equal(boundCurtain(2),1);assert.equal(boundCurtain(-1),0);assert.equal(boundCurtain(NaN),.5);
});
test('detective finds must be distinct actual validation errors rather than stored claimed scores',()=>{
  const validation=[{row:4,correct:false},{row:6,correct:true},{row:8,correct:false}];
  assert.deepEqual(verifiedFinds(validation,[4,4,6,99,8,4.5]),[4,8]);
  assert.deepEqual(verifiedFinds([{row:4,correct:true}],[4]),[]);
  const draft=readPlayDraft(JSON.stringify({key:'actual-input',mode:'detective',found:[4,4,8],revealed:false,score:100}));
  assert.deepEqual(draft,{key:'actual-input',mode:'detective',found:[4,8],revealed:false});
});
test('play drafts reject malformed modes and point ids',()=>{
  for(const value of ['broken',JSON.stringify({key:'x',mode:'graded',found:[],revealed:false}),JSON.stringify({key:'x',mode:'detective',found:[-1],revealed:false}),JSON.stringify({key:'x',mode:'detective',found:[null],revealed:false})]) assert.equal(readPlayDraft(value),null);
});
test('recipes start deterministic teaching cases without carrying edited training positions',()=>{
  const detective=recipeInput('detective',{...classDefaults,edits:[{row:3,x:1,y:2}]});
  assert.equal(detective.dataset,'xor');assert.equal(detective.model,'logistic');assert.deepEqual(detective.edits,[]);
  assert.equal(recipeInput('duel',classDefaults).dataset,'moons');assert.equal(recipeInput('garden',classDefaults).dataset,'iris');
  assert.equal(classRecipes.find(r=>r.id==='duel').mode,'compare');
});
