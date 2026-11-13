import type { Parameters } from "./experiment";
import type { BenchParameters } from "./bench";

export type ActionParameters = Parameters | BenchParameters;
export type ActionChange = {
  control: string;
  label: string;
  from_value: string | number;
  to_value: string | number;
};
export type ActionPlan = {
  id: string;
  kind: "synthetic" | "bench";
  mode: "online" | "rules";
  model: string | null;
  notice: string;
  hypothesis: string;
  expected: "lower" | "higher" | "uncertain";
  change: ActionChange;
  baseline_parameters: ActionParameters;
  target_parameters: ActionParameters;
  baseline_fingerprint: string;
};
export type VerifiedAction = {
  id: string;
  kind: "synthetic" | "bench";
  mode?: "online" | "rules";
  model?: string | null;
  change: ActionChange;
  hypothesis: string;
  expected: ActionPlan["expected"];
  executed_at: string;
  before: {
    dataset?: { title: string; unit: string };
    parameters: ActionParameters;
    metrics: Record<string, number>;
    data_fingerprint?: string;
    fingerprint?: string;
  };
  after: {
    parameters: ActionParameters;
    metrics: Record<string, number>;
    data_fingerprint?: string;
    fingerprint?: string;
  };
  metric: string;
  delta: number;
  observed: "lower" | "higher" | "unchanged";
  verdict: "supported" | "not_supported" | "observed";
  note: string;
  test_not_consulted: boolean;
};
export function parameterKey(parameters: ActionParameters) {
  return JSON.stringify(
    Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)),
  );
}
export function actionValue(control: string, value: string | number) {
  if (control === "fraction") return `${Math.round(Number(value) * 100)}%`;
  if (control === "model")
    return (
      (
        { ridge: "岭回归", tree: "决策树", forest: "随机森林" } as Record<
          string,
          string
        >
      )[String(value)] || String(value)
    );
  if (control === "alpha" && Number(value) < 0.001)
    return Number(value).toExponential(0);
  return String(value);
}
