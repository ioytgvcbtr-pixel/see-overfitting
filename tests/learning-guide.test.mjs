import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonGuide,recordObservation,lowestObserved} from '../src/lib/learning-guide.ts';
import {viewFromHash,hashForView} from '../src/lib/navigation.ts';
import {hasAttemptFor,readLearningDraft} from '../src/lib/learning-session.ts';
import {parameterKey} from '../src/lib/actions.ts';
import {readBenchSession} from '../src/lib/bench-session.ts';
import {conceptDefaults,conceptKey,editConceptPoint,weightFromPosition,readConceptInput} from '../src/lib/concepts.ts';
import {classDefaults,classKey,classComparisonKey,editClassPoint,readClassInput} from '../src/lib/classification.ts';

test('classification edits stay bounded, canonical, and leave public measurements unchanged',()=>{
  const edited=editClassPoint(classDefaults,8,99,-99);
  assert.deepEqual(edited.edits,[{row:8,x:3,y:-3}]);
  const replaced=editClassPoint(edited,8,.5,.25);
  assert.equal(replaced.edits.length,1);
  const second=editClassPoint(replaced,3,-1,1);
  assert.equal(classKey(second),classKey({...second,edits:[...second.edits].reverse()}));
  const publicInput={...classDefaults,dataset:'iris'};
  assert.equal(editClassPoint(publicInput,8,0,0),publicInput);
});
test('model display changes can preserve a comparison but hyperparameters cannot',()=>{
  assert.equal(classComparisonKey(classDefaults),classComparisonKey({...classDefaults,model:'knn'}));
  assert.notEqual(classKey(classDefaults),classKey({...classDefaults,model:'knn'}));
  for(const change of [{c:10},{fraction:.5},{seed:43},{noise:.3},{neighbors:3}]) assert.notEqual(classComparisonKey(classDefaults),classComparisonKey({...classDefaults,...change}));
  assert.equal(viewFromHash('#classification'),'classification');
});
test('classification draft excludes untrusted scores and rejects invalid interventions',()=>{
  const valid=editClassPoint(classDefaults,8,.5,.25);
  assert.deepEqual(readClassInput(JSON.stringify({...valid,metrics:{accuracy:1}})),valid);
  for(const bad of [{...valid,neighbors:0},{...valid,edits:[...valid.edits,...valid.edits]},{...valid,dataset:'iris'},{...valid,seed:0},{...valid,edits:[null]}]) assert.equal(readClassInput(JSON.stringify(bad)),null);
});

const parameters={scene:'complexity',degree:4,samples:12,noise:.22,alpha:1e-8,seed:42};
const fixture=(overrides,error)=>({parameters:{...parameters,...overrides},metrics:{train_mse:error/2,validation_mse:error}});

test('changing only the lesson variable keeps comparison conditions fixed',()=>{
  assert.equal(lessonGuide(parameters).conditionKey,lessonGuide({...parameters,degree:15}).conditionKey);
  assert.notEqual(lessonGuide(parameters).conditionKey,lessonGuide({...parameters,noise:.3}).conditionKey);
  assert.notEqual(lessonGuide(parameters).conditionKey,lessonGuide({...parameters,seed:43}).conditionKey);
});
test('observations contain actual returned conditions rather than visited buttons',()=>{
  let observations={conditionKey:'',items:{}};
  observations=recordObservation(observations,fixture({degree:1},.4));
  observations=recordObservation(observations,fixture({degree:15},.15));
  assert.equal(Object.keys(observations.items).length,2);
  assert.equal(lowestObserved(lessonGuide(parameters),observations).value,15);
  observations=recordObservation(observations,fixture({degree:4},.07));
  assert.equal(lowestObserved(lessonGuide(parameters),observations).value,4);
});
test('new data conditions cannot inherit an old comparison',()=>{
  const old=recordObservation({conditionKey:'',items:{}},fixture({degree:1},.4));
  const next=recordObservation(old,fixture({degree:4,noise:.3},.12));
  assert.deepEqual(Object.keys(next.items),['4']);
  assert.equal(lowestObserved(lessonGuide(parameters),next),null);
});
test('each lesson compares its own primary variable',()=>{
  assert.equal(lessonGuide({...parameters,scene:'samples'}).control,'samples');
  assert.equal(lessonGuide({...parameters,scene:'regularization'}).control,'alpha');
  assert.notEqual(lessonGuide({...parameters,scene:'samples'}).conditionKey,lessonGuide(parameters).conditionKey);
});
test('free exploration is not counted as a guided condition',()=>{
  const original={conditionKey:'',items:{}};
  assert.equal(recordObservation(original,fixture({degree:6},.08)),original);
});
test('module links and unknown fragments resolve predictably',()=>{
  for(const view of ['explore','concepts','classification','studio','datasets','path','history'])assert.equal(viewFromHash(hashForView(view)),view);
  assert.equal(viewFromHash('#unknown'),'studio');
  assert.equal(viewFromHash(''),'explore');
});
test('concept edits replace one point, remain bounded, and have canonical request keys',()=>{
  let p=editConceptPoint(conceptDefaults,0,9);
  assert.deepEqual(p.edits,[{index:0,y:3}]);
  p=editConceptPoint(p,0,1);
  assert.deepEqual(p.edits,[{index:0,y:1}]);
  assert.equal(editConceptPoint(p,99,1),p);
  const a={...p,edits:[{index:1,y:2},{index:0,y:1}]};
  assert.equal(conceptKey(a),conceptKey({...a,edits:[...a.edits].reverse()}));
});
test('loss landscape pointer coordinates map to the same visible slope and intercept axes',()=>{
  assert.deepEqual(weightFromPosition(44,18,400,320),{slope:-4,intercept:2});
  assert.deepEqual(weightFromPosition(380,284,400,320),{slope:4,intercept:-2});
  assert.deepEqual(weightFromPosition(212,151,400,320),{slope:0,intercept:0});
});
test('concept draft rejects invalid or duplicate interventions',()=>{
  assert.deepEqual(readConceptInput(JSON.stringify(conceptDefaults)),conceptDefaults);
  assert.equal(readConceptInput(JSON.stringify({...conceptDefaults,edits:[{index:0,y:1},{index:0,y:2}]})),null);
  assert.equal(readConceptInput(JSON.stringify({...conceptDefaults,samples:2})),null);
});
test('a result cannot be revealed without a prediction for the same fixed conditions',()=>{
  assert.equal(hasAttemptFor(parameters,null),false);
  const attempt={parameters,control:'degree'};
  assert.equal(hasAttemptFor({...parameters,degree:15},attempt),true);
  assert.equal(hasAttemptFor({...parameters,noise:.4},attempt),false);
  assert.equal(hasAttemptFor({...parameters,scene:'samples'},attempt),false);
});
test('action applicability uses values rather than object property order',()=>{
  assert.equal(parameterKey(parameters),parameterKey(Object.fromEntries(Object.entries(parameters).reverse())));
  assert.notEqual(parameterKey(parameters),parameterKey({...parameters,seed:43}));
});
test('real data session restores valid conditions but rejects broken numerical settings',()=>{
  const parameters={dataset:'auto',model:'forest',fraction:.75,depth:12,alpha:1,seed:43};
  assert.deepEqual(readBenchSession(JSON.stringify({parameters,display:'residual',feature:2,showTraining:true})),{parameters,display:'residual',feature:2,showTraining:true});
  assert.equal(readBenchSession('{broken'),null);
  assert.equal(readBenchSession(JSON.stringify({parameters:{...parameters,depth:99}})),null);
  assert.equal(readBenchSession(JSON.stringify({parameters:{...parameters,dataset:'unknown'}})),null);
});
test('unsubmitted practice restores its new seed without adding unsupported fields',()=>{
  const draft={...parameters,seed:656,unexpected:'discard'};
  assert.deepEqual(readLearningDraft(JSON.stringify(draft)),{...parameters,seed:656});
  assert.equal(readLearningDraft(JSON.stringify({...parameters,seed:1000001})),null);
  assert.equal(readLearningDraft(JSON.stringify({...parameters,scene:'unknown'})),null);
  assert.equal(readLearningDraft('broken'),null);
});
