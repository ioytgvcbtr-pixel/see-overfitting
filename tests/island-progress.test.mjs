import test from "node:test";
import assert from "node:assert/strict";
import { conceptDefaults, conceptKey } from "../src/lib/concepts.ts";
import { classDefaults, classKey } from "../src/lib/classification.ts";
import {
  readConceptDraft,
  readForestDraft,
} from "../src/lib/island-progress.ts";
const concept = {
  version: 1,
  kind: "concept",
  updatedAt: "2026-11-14T08:00:00Z",
  active: true,
  origin: conceptDefaults,
  start: conceptDefaults,
  current: conceptDefaults,
  selected: 0,
  answer: "higher",
  checked: { key: conceptKey(conceptDefaults), answer: "higher" },
  hintLevel: 1,
};
test("resumption retains bounded parameters and choices, never cached results or claimed awards", () => {
  const d = readConceptDraft(
    JSON.stringify({
      ...concept,
      score: 100,
      baseline: { train_mse: 0 },
      verified: true,
    }),
  );
  assert.deepEqual(d, concept);
  assert.equal("score" in d, false);
  assert.equal("baseline" in d, false);
});
test("stale checks are dropped and concept identities cannot cross islands", () => {
  assert.equal(
    readConceptDraft(JSON.stringify({ ...concept, answer: "lower" })).checked,
    null,
  );
  const d = readConceptDraft(
    JSON.stringify({
      ...concept,
      current: { ...conceptDefaults, slope: 2 },
      hintLevel: 99,
    }),
  );
  assert.equal(d.checked, null);
  assert.equal(d.hintLevel, 0);
  assert.equal(
    readConceptDraft(
      JSON.stringify({
        ...concept,
        start: { ...conceptDefaults, panel: "regularization" },
      }),
    ),
    null,
  );
  for (const raw of [
    "broken",
    "x".repeat(65537),
    JSON.stringify({ ...concept, updatedAt: "never" }),
    JSON.stringify({
      ...concept,
      current: { ...conceptDefaults, edits: [{ index: 500, y: 1 }] },
    }),
  ])
    assert.equal(readConceptDraft(raw), null);
});
test("forest restores rescue parameters but strips server predictions and invalid gates", () => {
  const f = {
    version: 1,
    kind: "forest",
    updatedAt: concept.updatedAt,
    active: false,
    current: classDefaults,
    row: 30,
    checked: { key: `${classKey(classDefaults)}:30`, gate: 1 },
    rescueInput: { ...classDefaults, model: "tree" },
    rescueRow: 30,
    hintLevel: 2,
    rescueHint: 1,
  };
  const d = readForestDraft(
    JSON.stringify({ ...f, metrics: { validation_accuracy: 1 }, fixed: true }),
  );
  assert.deepEqual(d, f);
  assert.equal(
    readForestDraft(
      JSON.stringify({ ...f, checked: { ...f.checked, gate: 2 } }),
    ).checked,
    null,
  );
  assert.equal(readForestDraft(JSON.stringify({ ...f, rescueRow: -1 })), null);
  assert.equal(
    readForestDraft(
      JSON.stringify({
        ...f,
        current: {
          ...classDefaults,
          dataset: "iris",
          edits: [{ row: 1, x: 1, y: 1 }],
        },
      }),
    ),
    null,
  );
});
