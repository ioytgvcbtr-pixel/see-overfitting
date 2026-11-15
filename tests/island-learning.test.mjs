import test from 'node:test';
import assert from 'node:assert/strict';
import { inputKey, learningReference, proofNumber, readIslandDraft, preferredDraft, checkpointPayload } from '../src/lib/island-learning.ts';
import { conceptDefaults } from '../src/lib/concepts.ts';

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
test('unfinished experiment drafts keep precise inputs and selected points, never scores',()=>{
  const draft={id:'b'.repeat(32),stage:'experiment',parameters:{...conceptDefaults,intercept:-.35},selected:4,choice:null,confidence:2,reason:'',transfer_choice:null,transfer_reason:null,client_updated_at:'2026-11-15T12:00:02.000Z'};
  const value=readIslandDraft(JSON.stringify({...draft,passed:true,metrics:{validation_mse:0}}));
  assert.deepEqual(value,draft);assert.equal(checkpointPayload(value).parameters.intercept,-.35);
  assert.equal('id' in checkpointPayload(value),false);
  assert.equal(readIslandDraft(JSON.stringify({...draft,selected:80})),null);
});
test('restore selects the newest matching stage and cannot reopen a submitted step',()=>{
  const id='c'.repeat(32),d={id,stage:'experiment',parameters:conceptDefaults,selected:2,choice:null,confidence:2,reason:'',transfer_choice:null,transfer_reason:null,client_updated_at:'2026-11-15T12:00:02.000Z'};
  const attempt={id,panel:'error',stage:'experiment',checkpoint:{...d,selected:1,client_updated_at:'2026-11-15T12:00:01.000Z'}};
  assert.equal(preferredDraft(attempt,d).selected,2);
  assert.equal(preferredDraft({...attempt,stage:'complete'},d),null);
  assert.equal(preferredDraft({...attempt,panel:'sensitivity'},d),null);
});
