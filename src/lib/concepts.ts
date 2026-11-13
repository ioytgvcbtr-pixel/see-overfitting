export type ConceptPanel = "error" | "sensitivity" | "regularization";
export type ConceptInput = {
  panel: ConceptPanel;
  seed: 2026 | 314 | 2718;
  samples: number;
  noise: number;
  degree: number;
  alpha: number;
  slope: number;
  intercept: number;
  edits: { index: number; y: number }[];
};
export const conceptDefaults: ConceptInput = {
  panel: "error",
  seed: 2026,
  samples: 12,
  noise: 0.22,
  degree: 12,
  alpha: 1e-6,
  slope: 0.5,
  intercept: 0,
  edits: [],
};
export const conceptAlphas = [1e-8, 1e-6, 1e-4, 0.01, 0.1, 1, 10, 100];
export type ConceptModel = {
  degree: number;
  alpha: number;
  train_mse: number;
  validation_mse: number;
  curve: number[];
  weights: number[];
  weight_norm: number;
  sse: number;
  penalty: number;
  objective: number;
};
export type ConceptResult = {
  parameters: ConceptInput;
  train: { x: number; y: number; original_y: number }[];
  validation: { x: number; y: number }[];
  grid_x: number[];
  truth: number[];
  y_extent: number;
  data_fingerprint: string;
  validation_fingerprint: string;
  elapsed_ms: number;
  split: { training: number; validation: number; test_sealed: boolean };
  protocol: string;
  linear?: {
    slope: number;
    intercept: number;
    train_mse: number;
    validation_mse: number;
    sse: number;
    curve: number[];
    residuals: { predicted: number; error: number; squared: number }[];
    optimum: {
      slope: number;
      intercept: number;
      train_mse: number;
      in_view: boolean;
    };
    surface: {
      columns: number;
      rows: number;
      values: number[];
      minimum: number;
      maximum: number;
      contours: { mse: number; points: number[][] }[];
    };
  };
  pairs?: {
    baseline: ConceptModel;
    edited: ConceptModel;
    difference: number[];
    shift_rms: number;
    validation_delta: number;
  }[];
  max_shift?: number;
  label_shift_rms?: number;
  regularization?: {
    weak: ConceptModel;
    current: ConceptModel;
    basis: string;
    objective_definition: string;
    path: {
      alpha: number;
      norm: number;
      train_mse: number;
      validation_mse: number;
    }[];
  };
};
export const bounded = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const conceptNumber = (value: number) =>
  Number.isFinite(value)
    ? value === 0
      ? "0"
      : Math.abs(value) < 0.0001 || Math.abs(value) > 9999
        ? value.toExponential(2)
        : value.toFixed(4)
    : "—";
export const alphaText = (value: number) =>
  value < 0.001 ? value.toExponential(0) : String(value);
export function conceptKey(p: ConceptInput) {
  return JSON.stringify([
    p.panel,
    p.seed,
    p.samples,
    p.noise,
    p.degree,
    p.alpha,
    p.slope,
    p.intercept,
    [...p.edits]
      .sort((a, b) => a.index - b.index)
      .map((row) => [row.index, row.y]),
  ]);
}
export function editConceptPoint(
  p: ConceptInput,
  index: number,
  y: number,
): ConceptInput {
  if (index < 0 || index >= p.samples || !Number.isFinite(y)) return p;
  return {
    ...p,
    edits: [
      ...p.edits.filter((row) => row.index !== index),
      { index, y: bounded(y, -3, 3) },
    ].sort((a, b) => a.index - b.index),
  };
}
export function weightFromPosition(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    slope: bounded(-4 + ((x - 44) / (width - 64)) * 8, -4, 4),
    intercept: bounded(2 - ((y - 18) / (height - 54)) * 4, -2, 2),
  };
}
export function readConceptInput(raw: string | null): ConceptInput | null {
  try {
    const p = JSON.parse(raw || "null");
    if (
      !p ||
      !["error", "sensitivity", "regularization"].includes(p.panel) ||
      ![2026, 314, 2718].includes(p.seed)
    )
      return null;
    if (
      !Number.isInteger(p.samples) ||
      p.samples < 12 ||
      p.samples > 60 ||
      !Number.isFinite(p.noise) ||
      p.noise < 0 ||
      p.noise > 0.6 ||
      !Number.isInteger(p.degree) ||
      p.degree < 1 ||
      p.degree > 15 ||
      !conceptAlphas.includes(p.alpha) ||
      !Number.isFinite(p.slope) ||
      Math.abs(p.slope) > 4 ||
      !Number.isFinite(p.intercept) ||
      Math.abs(p.intercept) > 2 ||
      !Array.isArray(p.edits) ||
      p.edits.length > p.samples
    )
      return null;
    if (
      new Set(p.edits.map((row: { index: number }) => row.index)).size !==
        p.edits.length ||
      p.edits.some(
        (row: { index: number; y: number }) =>
          !Number.isInteger(row.index) ||
          row.index < 0 ||
          row.index >= p.samples ||
          !Number.isFinite(row.y) ||
          Math.abs(row.y) > 3,
      )
    )
      return null;
    return {
      panel: p.panel,
      seed: p.seed,
      samples: p.samples,
      noise: p.noise,
      degree: p.degree,
      alpha: p.alpha,
      slope: p.slope,
      intercept: p.intercept,
      edits: p.edits,
    };
  } catch {
    return null;
  }
}
