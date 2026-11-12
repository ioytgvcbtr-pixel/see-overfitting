export type DatasetId = "wine" | "auto" | "concrete";
export type ModelId = "ridge" | "tree" | "forest";
export type BenchParameters = {
  dataset: DatasetId;
  model: ModelId;
  fraction: number;
  depth: number;
  alpha: number;
  seed: number;
};
export type Dataset = {
  id: DatasetId;
  title: string;
  subtitle: string;
  domain: string;
  target: string;
  unit: string;
  color: string;
  features: string[];
  rows: number;
  removed_missing_rows: number;
  duplicate_feature_rows: number;
  unique_feature_groups: number;
  source: string;
  citation: string;
  license: string;
  license_url: string;
  version: string;
};
export type Prediction = {
  row: number;
  actual: number;
  prediction: number;
  residual: number;
  features: number[];
};
export type BenchMetrics = {
  train_rmse: number;
  validation_rmse: number;
  validation_r2: number;
  gap: number;
  baseline_rmse: number;
};
export type BenchResult = {
  parameters: BenchParameters;
  dataset: Dataset;
  model_name: string;
  metrics: BenchMetrics;
  training_predictions: Prediction[];
  validation_predictions: Prediction[];
  fingerprint: string;
  split: {
    training: number;
    training_pool: number;
    validation: number;
    test: number;
    test_sealed: boolean;
    grouped_by_features: boolean;
  };
  protocol: string;
  elapsed_ms: number;
};
export type Comparison = {
  models: {
    model: string;
    name: string;
    train_rmse: number;
    validation_rmse: number;
    validation_r2: number;
  }[];
  best: string;
  fingerprint: string;
};
export type Learning = {
  points: {
    fraction: number;
    samples: number;
    train_rmse: number;
    validation_rmse: number;
  }[];
};
export type Stability = {
  runs: { seed: number; best: string; models: Comparison["models"] }[];
  summary: { model: string; name: string; mean: number; std: number }[];
  ranking_agrees: boolean;
  note: string;
};
export type BenchCoach = {
  mode: "online" | "rules";
  model: string | null;
  content: string;
  notice: string;
  reasoning_effort: string;
  provider_effort: string;
};
export const initialBench: BenchParameters = {
  dataset: "concrete",
  model: "tree",
  fraction: 0.5,
  depth: 5,
  alpha: 1,
  seed: 42,
};
export const modelNames: Record<ModelId, string> = {
  ridge: "岭回归",
  tree: "决策树",
  forest: "随机森林",
};
export const number = (value: number, digits = 3) =>
  Math.abs(value) >= 10000 ? value.toExponential(2) : value.toFixed(digits);
