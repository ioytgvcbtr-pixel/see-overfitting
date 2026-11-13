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
