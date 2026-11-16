import type { ConceptInput } from "./concepts";
import type { ClassInput } from "./classification";
import { readConceptInput } from "./concepts.ts";
import { readClassInput } from "./classification.ts";

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
  first_choice?: number; goal_met?: boolean;
};
export type IslandTask = {
  id?: string; panel: IslandId; mode: "discovery" | "counterexample";
  title: string; context: string; question: string; choices: string[]; reasons: string[];
  operation: string; control: string; focus: string; seed: number;
  selected: number; row: number | null;
  before_parameters: IslandInput; target_parameters: IslandInput;
  investigation?: boolean; question_kind?: string;
  content_version?: number;
  assessment?: {columns:string[];rows:{label:string;values:number[];parameters?:IslandInput}[];percent:boolean;note:string};
};
export type IslandAttempt = {
  id: string; created_at: string; panel: IslandId; mode: IslandTask["mode"];
  stage: "predict" | "experiment" | "review" | "transfer" | "complete";
  prediction: { choice: number; confidence: number; reason: string; planned_alpha?: number | null } | null;
  observation: IslandProof | null; task: IslandTask;
  transfer_task: IslandTask | null; hints_used: number; ai_before_transfer: string[];
  transfer_answer: {
    choice: number; reason: number; passed: boolean; assisted: boolean;
    choice_correct: boolean; reason_correct: boolean; correct_reason: number; proof: IslandProof;
  } | null;
  transfer_decision?: {task_id:string;choice:number;submitted_at:string};
  checkpoint?: IslandDraft;
  practice_of?: string;
  practice_focus?: string;
  repeated_case?: boolean;
  imported_at?: string;
  trials?: {parameters:IslandInput;proof:IslandProof;observed_at:string}[];
};
export type IslandLaunch = { attempt: IslandAttempt; serial: number };
export type NextLesson = (panel: IslandId | "history") => Promise<void>;
export type IslandDraft = {
  id: string; stage: "predict" | "experiment" | "transfer"; parameters: IslandInput; selected: number;
  choice: number | null; confidence: number; reason: string;
  transfer_choice: number | null; transfer_reason: number | null;
  client_updated_at: string; updated_at?: string;
  planned_alpha?: number | null;
};
export function draftKey(id: string) { return `fitlab-island-draft-v14-${id}`; }
export function readIslandDraft(raw: string | null): IslandDraft | null {
  if (!raw || raw.length > 64000) return null;
  try {
    const d = JSON.parse(raw);
    if (!learningReference(d.id) || !["predict","experiment","transfer"].includes(d.stage)) return null;
    const p = d.parameters?.dataset ? readClassInput(JSON.stringify(d.parameters)) : readConceptInput(JSON.stringify(d.parameters));
    const validChoice = (v: unknown) => v === null || (Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 2);
    if (!p || !Number.isInteger(d.selected) || d.selected < 0 || d.selected >= ("samples" in p ? p.samples : 300) ||
        !validChoice(d.choice) || !validChoice(d.transfer_choice) || !validChoice(d.transfer_reason) ||
        ![1,2,3].includes(d.confidence) || typeof d.reason !== "string" || d.reason.length > 500 ||
        typeof d.client_updated_at !== "string" || !Number.isFinite(Date.parse(d.client_updated_at))) return null;
    return {id:d.id,stage:d.stage,parameters:p,selected:d.selected,choice:d.choice,confidence:d.confidence,reason:d.reason,
      transfer_choice:d.transfer_choice,transfer_reason:d.transfer_reason,client_updated_at:d.client_updated_at,
      ...(typeof d.planned_alpha==='number' && [1e-8,1e-6,1e-4,.01,.1,1,10,100].includes(d.planned_alpha) ? {planned_alpha:d.planned_alpha}: {})};
  } catch { return null; }
}
export function checkpointPayload(d: IslandDraft) {
  const { id: _id, updated_at: _updated, ...body } = d;
  return body;
}
export function preferredDraft(attempt: IslandAttempt, local: IslandDraft | null): IslandDraft | null {
  const fromServer = attempt.checkpoint ? readIslandDraft(JSON.stringify({...attempt.checkpoint,id:attempt.id,
    client_updated_at:attempt.checkpoint.client_updated_at || attempt.checkpoint.updated_at})) : null;
  const candidates = [fromServer,local].filter((d): d is IslandDraft => !!d && d.id===attempt.id && d.stage===attempt.stage &&
    (attempt.panel === "forest" ? "dataset" in d.parameters : "panel" in d.parameters && d.parameters.panel===attempt.panel));
  return candidates.sort((a,b)=>b.client_updated_at.localeCompare(a.client_updated_at))[0] ?? null;
}
export type IslandPlan = {
  id: string; mode: "online" | "rules"; model: string | null; notice: string;
  hypothesis: string; expected: "lower" | "higher" | "uncertain";
  baseline_parameters: IslandInput; target_parameters: IslandInput;
  change: { control: string; label: string; from_value: string | number; to_value: string | number };
  learning_focus?: {label:string;status?:string};
  execution: { before: number; after: number; metric: string; verdict: "observed" | "supported" | "not_supported";
    validation_fingerprint: string; test_sealed: boolean;
    observations?:{metric:string;before:number;after:number}[] } | null;
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
