import type { Parameters, Result } from "./experiment";

export type TransferTask = {
  id: string;
  seed: number;
  question: string;
  options: string[];
  reasons: string[];
  rows: {
    name: string;
    label: string;
    parameters: Parameters;
    metrics: Result["metrics"];
    data_fingerprint: string;
  }[];
};
export type TransferAnswer = {
  task: TransferTask;
  choice: number;
  reason: number;
  passed: boolean;
  correct_choice: number;
  explanation: string;
  submitted_at: string;
};
export type LearningAttempt = {
  id: string;
  created_at: string;
  parameters: Parameters;
  last_parameters?: Parameters;
  control: "degree" | "samples" | "alpha";
  stage: "experiment" | "transfer" | "complete";
  prediction: {
    choice: number;
    value: number;
    label: string;
    confidence: number;
    reason: string;
    submitted_at: string;
  };
  observations: (Pick<Result, "parameters" | "metrics" | "data_fingerprint"> & {
    index: number;
    value: number;
    label: string;
    observed_at: string;
  })[];
  task: TransferTask | null;
  transfer_attempts: TransferAnswer[];
  completed_at?: string;
  prediction_review?: { matched: boolean; best_labels: string[]; note: string };
};

export function hasAttemptFor(
  params: Parameters,
  attempt: LearningAttempt | null,
) {
  if (!attempt) return false;
  return (Object.keys(params) as (keyof Parameters)[]).every(
    (key) => key === attempt.control || params[key] === attempt.parameters[key],
  );
}

export function readLearningDraft(raw: string | null): Parameters | null {
  try {
    const p = JSON.parse(raw || "null");
    if (!p || !["complexity", "samples", "regularization"].includes(p.scene))
      return null;
    if (
      !Number.isInteger(p.degree) ||
      p.degree < 1 ||
      p.degree > 15 ||
      !Number.isInteger(p.samples) ||
      p.samples < 12 ||
      p.samples > 160 ||
      !Number.isFinite(p.noise) ||
      p.noise < 0 ||
      p.noise > 0.6 ||
      !Number.isFinite(p.alpha) ||
      p.alpha < 1e-8 ||
      p.alpha > 100 ||
      !Number.isInteger(p.seed) ||
      p.seed < 0 ||
      p.seed > 999999
    )
      return null;
    return {
      scene: p.scene,
      degree: p.degree,
      samples: p.samples,
      noise: p.noise,
      alpha: p.alpha,
      seed: p.seed,
    };
  } catch {
    return null;
  }
}
