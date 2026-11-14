import {
  readConceptInput,
  conceptKey,
  type ConceptInput,
  type ConceptPanel,
} from "./concepts.ts";
import { readClassInput, classKey, type ClassInput } from "./classification.ts";

export type ChallengeId = ConceptPanel | "forest";
export type SavedCheck = { key: string; answer: string };
export type ConceptDraft = {
  version: 1;
  kind: "concept";
  updatedAt: string;
  active: boolean;
  origin: ConceptInput;
  start: ConceptInput;
  current: ConceptInput;
  selected: number;
  answer: string;
  checked: SavedCheck | null;
  hintLevel: number;
};
export type ForestDraft = {
  version: 1;
  kind: "forest";
  updatedAt: string;
  active: boolean;
  current: ClassInput;
  row: number;
  checked: { key: string; gate: number } | null;
  rescueInput: ClassInput | null;
  rescueRow: number | null;
  hintLevel: number;
  rescueHint: number;
};
export type ChallengeDraft = ConceptDraft | ForestDraft;
export const challengeIds: ChallengeId[] = [
  "error",
  "sensitivity",
  "regularization",
  "forest",
];
export const challengeTitles: Record<ChallengeId, string> = {
  error: "误差湖",
  sensitivity: "曲线山",
  regularization: "约束花园",
  forest: "边界森林",
};
const prefix = "fitlab-island-progress-v1:";
function base(raw: string | null, kind: string) {
  if (!raw || raw.length > 65536) return null;
  try {
    const p = JSON.parse(raw);
    return p &&
      p.version === 1 &&
      p.kind === kind &&
      typeof p.active === "boolean" &&
      typeof p.updatedAt === "string" &&
      p.updatedAt.length <= 40 &&
      Number.isFinite(Date.parse(p.updatedAt))
      ? p
      : null;
  } catch {
    return null;
  }
}
const level = (n: unknown) =>
  Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 2 ? Number(n) : 0;
export function readConceptDraft(raw: string | null): ConceptDraft | null {
  const p = base(raw, "concept");
  if (!p) return null;
  const origin = readConceptInput(JSON.stringify(p.origin)),
    start = readConceptInput(JSON.stringify(p.start)),
    current = readConceptInput(JSON.stringify(p.current));
  if (
    !origin ||
    !start ||
    !current ||
    origin.panel !== current.panel ||
    start.panel !== current.panel
  )
    return null;
  const selected = p.selected ?? 0;
  if (
    !Number.isInteger(selected) ||
    selected < 0 ||
    selected >= current.samples
  )
    return null;
  const choices =
    current.panel === "sensitivity"
      ? ["a", "b", "same"]
      : ["lower", "higher", "same"];
  const answer = choices.includes(p.answer) ? p.answer : "";
  const checked =
    p.checked &&
    p.checked.key === conceptKey(current) &&
    p.checked.answer === answer &&
    choices.includes(p.checked.answer)
      ? { key: p.checked.key, answer: p.checked.answer }
      : null;
  return {
    version: 1,
    kind: "concept",
    updatedAt: p.updatedAt,
    active: p.active,
    origin,
    start,
    current,
    selected,
    answer,
    checked,
    hintLevel: level(p.hintLevel),
  };
}
export function readForestDraft(raw: string | null): ForestDraft | null {
  const p = base(raw, "forest");
  if (!p) return null;
  const current = readClassInput(JSON.stringify(p.current));
  if (!current || !Number.isInteger(p.row) || p.row < 0 || p.row > 299)
    return null;
  const count = ["iris", "seeds"].includes(current.dataset) ? 3 : 2;
  const checked =
    p.checked &&
    p.checked.key === `${classKey(current)}:${p.row}` &&
    Number.isInteger(p.checked.gate) &&
    p.checked.gate >= 0 &&
    p.checked.gate < count
      ? { key: p.checked.key, gate: p.checked.gate }
      : null;
  const rescueInput =
    p.rescueInput == null
      ? null
      : readClassInput(JSON.stringify(p.rescueInput));
  if (
    p.rescueInput != null &&
    (!rescueInput ||
      !Number.isInteger(p.rescueRow) ||
      p.rescueRow < 0 ||
      p.rescueRow > 299)
  )
    return null;
  return {
    version: 1,
    kind: "forest",
    updatedAt: p.updatedAt,
    active: p.active,
    current,
    row: p.row,
    checked,
    rescueInput,
    rescueRow: rescueInput ? p.rescueRow : null,
    hintLevel: level(p.hintLevel),
    rescueHint: level(p.rescueHint),
  };
}
export function readProgress(id: ChallengeId): ChallengeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(prefix + id);
    const draft =
      id === "forest" ? readForestDraft(raw) : readConceptDraft(raw);
    return draft && (draft.kind === "forest" || draft.current.panel === id)
      ? draft
      : null;
  } catch {
    return null;
  }
}
export function saveProgress(draft: ChallengeDraft) {
  const raw = JSON.stringify(draft),
    clean =
      draft.kind === "forest" ? readForestDraft(raw) : readConceptDraft(raw);
  if (!clean) return false;
  try {
    localStorage.setItem(
      prefix + (clean.kind === "forest" ? "forest" : clean.current.panel),
      JSON.stringify(clean),
    );
    return true;
  } catch {
    return false;
  }
}
export function activateProgress(id: ChallengeId) {
  const d = readProgress(id);
  return (
    !!d &&
    saveProgress({ ...d, active: true, updatedAt: new Date().toISOString() })
  );
}
export function pauseProgress(id: ChallengeId) {
  const d = readProgress(id);
  return !!d && saveProgress({ ...d, active: false });
}
export function latestProgress() {
  return challengeIds
    .map((id) => ({ id, draft: readProgress(id) }))
    .filter((v): v is { id: ChallengeId; draft: ChallengeDraft } => !!v.draft)
    .sort(
      (a, b) => Date.parse(b.draft.updatedAt) - Date.parse(a.draft.updatedAt),
    );
}
