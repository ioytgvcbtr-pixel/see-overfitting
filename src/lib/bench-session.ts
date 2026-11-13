import type { BenchParameters } from "./bench";
export type BenchView =
  "parity" | "residual" | "feature" | "learning" | "compare" | "stability";
export type BenchSession = {
  parameters: BenchParameters;
  display: BenchView;
  feature: number;
  showTraining: boolean;
};
export function readBenchSession(raw: string | null): BenchSession | null {
  try {
    const value = JSON.parse(raw || "null");
    const p = value?.parameters;
    if (
      !p ||
      !["wine", "auto", "concrete"].includes(p.dataset) ||
      !["ridge", "tree", "forest"].includes(p.model)
    )
      return null;
    if (
      !Number.isFinite(p.fraction) ||
      p.fraction < 0.1 ||
      p.fraction > 1 ||
      !Number.isInteger(p.depth) ||
      p.depth < 1 ||
      p.depth > 15 ||
      !Number.isFinite(p.alpha) ||
      p.alpha < 0.000001 ||
      p.alpha > 1000 ||
      !Number.isInteger(p.seed) ||
      p.seed < 0 ||
      p.seed > 999999
    )
      return null;
    return {
      parameters: p,
      display: [
        "parity",
        "residual",
        "feature",
        "learning",
        "compare",
        "stability",
      ].includes(value.display)
        ? value.display
        : "parity",
      feature:
        Number.isInteger(value.feature) &&
        value.feature >= 0 &&
        value.feature <
          (p.dataset === "wine" ? 11 : p.dataset === "auto" ? 7 : 8)
          ? value.feature
          : 0,
      showTraining: value.showTraining === true,
    };
  } catch {
    return null;
  }
}
