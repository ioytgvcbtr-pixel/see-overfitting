import type { ConceptInput } from "./concepts";
import type { ClassInput } from "./classification";

export type IslandId = "error" | "sensitivity" | "regularization" | "forest";
export type IslandInput = ConceptInput | ClassInput;
export type IslandProof = {
  before: number; after: number; metric: string; choice: number;
  before_train?: number; after_train?: number;
  before_norm?: number; after_norm?: number;
  before_mistakes?: number; after_mistakes?: number;
  a_validation?: number; b_validation?: number;
  row?: number; fixed?: boolean;
  matched?: boolean; conclusion?: string; validation_fingerprint: string;
};
export type IslandTask = {
  id?: string; panel: IslandId; mode: "discovery" | "counterexample";
  title: string; context: string; question: string; choices: string[]; reasons: string[];
  operation: string; control: string; focus: string; seed: number;
  selected: number; row: number | null;
  before_parameters: IslandInput; target_parameters: IslandInput;
};
export type IslandAttempt = {
  id: string; created_at: string; panel: IslandId; mode: IslandTask["mode"];
  stage: "predict" | "experiment" | "review" | "transfer" | "complete";
  prediction: { choice: number; confidence: number; reason: string } | null;
  observation: IslandProof | null; task: IslandTask;
  transfer_task: IslandTask | null; hints_used: number; ai_before_transfer: string[];
  transfer_answer: {
    choice: number; reason: number; passed: boolean; assisted: boolean;
    choice_correct: boolean; reason_correct: boolean; correct_reason: number; proof: IslandProof;
  } | null;
};
export type IslandPlan = {
  id: string; mode: "online" | "rules"; model: string | null; notice: string;
  hypothesis: string; expected: "lower" | "higher" | "uncertain";
  baseline_parameters: IslandInput; target_parameters: IslandInput;
  change: { control: string; label: string; from_value: string | number; to_value: string | number };
  execution: { before: number; after: number; metric: string; verdict: "observed" | "supported" | "not_supported";
    validation_fingerprint: string; test_sealed: boolean } | null;
};
export const islandNames: Record<IslandId, string> = {
  error: "误差湖", sensitivity: "曲线山", regularization: "约束花园", forest: "边界森林",
};
export function inputKey(input: unknown): string {
  if (Array.isArray(input)) return `[${input.map(inputKey).join(",")}]`;
  if (input && typeof input === "object") return `{${Object.entries(input).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${JSON.stringify(key)}:${inputKey(value)}`).join(",")}}`;
  return JSON.stringify(input);
}
export function learningReference(raw: string | null): string | null {
  return raw && /^[0-9a-f]{32}$/.test(raw) ? raw : null;
}
export function proofNumber(value: number, panel: IslandId): string {
  return panel === "forest" ? `${(100 * value).toFixed(1)}%` :
    value !== 0 && (Math.abs(value) < .0001 || Math.abs(value) > 9999) ? value.toExponential(2) : value.toFixed(4);
}
