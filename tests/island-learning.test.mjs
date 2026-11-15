import test from 'node:test';
import assert from 'node:assert/strict';
import { inputKey, learningReference, proofNumber } from '../src/lib/island-learning.ts';

test('learning references accept only server IDs, never browser scores or objects', () => {
  assert.equal(learningReference('a'.repeat(32)), 'a'.repeat(32));
  for (const raw of [null, '', '../attempt', '{"passed":true}', 'a'.repeat(33)]) assert.equal(learningReference(raw), null);
});
test('input comparison ignores object key order but preserves changed conditions', () => {
  assert.equal(inputKey({alpha:.01, edits:[{index:1,y:.2}]}), inputKey({edits:[{y:.2,index:1}],alpha:.01}));
  assert.notEqual(inputKey({seed:314}), inputKey({seed:2026}));
});
test('small numerical differences stay readable and forest metrics use percentages', () => {
  assert.equal(proofNumber(.96666667,'forest'), '96.7%');
  assert.equal(proofNumber(.00000021,'regularization'), '2.10e-7');
});
