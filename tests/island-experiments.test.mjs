import test from "node:test";
import assert from "node:assert/strict";
import {
  railValue,
  dialIndex,
  direction,
  observeQuest,
  rescueObservation,
  deliveryGate,
} from "../src/lib/island-experiments.ts";

const parameters = {
  panel: "error",
  seed: 2026,
  samples: 12,
  noise: 0.22,
  degree: 12,
  alpha: 1e-8,
  edits: [],
};
const make = (patch = {}) => ({
  parameters,
  data_fingerprint: "training",
  validation_fingerprint: "validation",
  linear: { train_mse: 5, validation_mse: 4, optimum: { train_mse: 1 } },
  ...patch,
});
test("scene rails map reversed y axes, clamp overshoot, and snap discrete controls", () => {
  assert.equal(railValue(258, 258, 48, -3, 3, 0.05), -3);
  assert.equal(railValue(48, 258, 48, -3, 3, 0.05), 3);
  assert.equal(railValue(-100, 258, 48, -3, 3, 0.05), 3);
  assert.equal(railValue(500, 0, 100, 0, 7, 1), 7);
  assert.equal(railValue(50, 0, 100, 0, 7, 1), 4);
  assert.equal(dialIndex(0, -10, 0, 0), 4);
  assert.equal(dialIndex(10, 10, 0, 0), 7);
  assert.equal(dialIndex(-10, 10, 0, 0), 0);
});
test("error harbour measures avoidable error, rejects moved data, and reports validation independently", () => {
  const start = make(),
    improved = make({
      linear: { train_mse: 2, validation_mse: 6, optimum: { train_mse: 1 } },
    });
  const q = observeQuest(start, improved);
  assert.equal(q.ready, true);
  assert.equal(q.progress, 0.75);
  assert.equal(q.correct, "higher");
  assert.equal(
    observeQuest(
      start,
      make({ linear: { ...improved.linear, train_mse: 2.01 } }),
    ).ready,
    false,
  );
  assert.equal(
    observeQuest(start, { ...improved, data_fingerprint: "moved" }).ready,
    false,
  );
  assert.equal(
    observeQuest(start, {
      ...improved,
      validation_fingerprint: "other-holdout",
    }).ready,
    false,
  );
  assert.equal(
    observeQuest(make({ linear: { ...start.linear, train_mse: 1 } }), improved)
      .ready,
    false,
  );
});
test("paired road task requires a real perturbation and accepts either winner or ties", () => {
  const base = make({ parameters: { ...parameters, panel: "sensitivity" } });
  const now = {
    ...base,
    label_shift_rms: 0.2,
    pairs: [{ shift_rms: 0.8 }, { shift_rms: 0.2 }],
  };
  assert.equal(observeQuest(base, now).correct, "a");
  assert.equal(
    observeQuest(base, {
      ...now,
      pairs: [{ shift_rms: 0.2 }, { shift_rms: 0.8 }],
    }).correct,
    "b",
  );
  assert.equal(
    observeQuest(base, {
      ...now,
      pairs: [{ shift_rms: 0.2 }, { shift_rms: 0.2 }],
    }).correct,
    "same",
  );
  assert.equal(observeQuest(base, { ...now, label_shift_rms: 0 }).ready, false);
  assert.equal(direction(1 + 1e-9, 1), "same");
});
test("garden task keeps the feature basis fixed and does not equate shrinking with better validation", () => {
  const start = make({
    parameters: { ...parameters, panel: "regularization" },
    regularization: { current: { weight_norm: 10, validation_mse: 1 } },
  });
  const now = {
    ...start,
    parameters: { ...start.parameters, alpha: 0.1 },
    regularization: { current: { weight_norm: 5, validation_mse: 2 } },
  };
  assert.equal(observeQuest(start, now).ready, true);
  assert.equal(observeQuest(start, now).correct, "higher");
  assert.equal(
    observeQuest(start, {
      ...now,
      parameters: { ...now.parameters, degree: 3 },
    }).ready,
    false,
  );
});
test("rescue fixes the pinned validation row and reveals whole-set regression too", () => {
  const before = {
    fingerprint: "x",
    validation_fingerprint: "v",
    validation: [{ row: 30, correct: false, label: 0, prediction: 1 }],
    metrics: { validation_accuracy: 0.8 },
  };
  const now = {
    ...before,
    validation: [{ row: 30, correct: true, label: 0, prediction: 0 }],
    metrics: { validation_accuracy: 0.7 },
  };
  assert.deepEqual(rescueObservation(before, now, 30), {
    fixed: true,
    before_prediction: 1,
    prediction: 0,
    label: 0,
    before_accuracy: 0.8,
    accuracy: 0.7,
  });
  assert.equal(
    rescueObservation(before, { ...now, fingerprint: "changed" }, 30),
    null,
  );
  assert.equal(
    rescueObservation(
      before,
      { ...now, validation_fingerprint: "changed" },
      30,
    ),
    null,
  );
  assert.equal(rescueObservation(now, now, 30), null);
  assert.equal(deliveryGate(-1, 300, 3), 0);
  assert.equal(deliveryGate(301, 300, 3), 2);
  assert.equal(deliveryGate(150, 300, 3), 1);
});
