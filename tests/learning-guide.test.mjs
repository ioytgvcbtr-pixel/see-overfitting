import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonGuide,recordObservation,lowestObserved} from '../src/lib/learning-guide.ts';
import {viewFromHash,hashForView} from '../src/lib/navigation.ts';

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
  for(const view of ['studio','datasets','path','history'])assert.equal(viewFromHash(hashForView(view)),view);
  assert.equal(viewFromHash('#unknown'),'studio');
});
