import type { ClassInput, ClassPoint, ClassResult } from "./classification";

export type PlayMode = "explore" | "detective" | "compare";
export const classRecipes = [
  {
    id: "detective",
    title: "错分侦探",
    description: "在线性模型看不懂的XOR中，找到被看错的验证点。",
    dataset: "xor",
    model: "logistic",
    mode: "detective",
  },
  {
    id: "duel",
    title: "边界掀幕",
    description: "先定格一条线，再换一个模型，拖开两种判断的分界。",
    dataset: "moons",
    model: "logistic",
    mode: "compare",
  },
  {
    id: "garden",
    title: "花瓣辨认",
    description: "只看两个花瓣特征，观察三个品种在哪里交叠。",
    dataset: "iris",
    model: "svm",
    mode: "explore",
  },
] as const;
export type ClassRecipeId = (typeof classRecipes)[number]["id"];
export function recipeInput(
  id: ClassRecipeId,
  defaults: ClassInput,
): ClassInput {
  const recipe = classRecipes.find((row) => row.id === id)!;
  return {
    ...defaults,
    dataset: recipe.dataset,
    model: recipe.model,
    edits: [],
  };
}
export function canCompareRegions(
  a: ClassResult | null,
  b: ClassResult | null,
) {
  return (
    !!a &&
    !!b &&
    a.fingerprint === b.fingerprint &&
    a.parameters.dataset === b.parameters.dataset &&
    JSON.stringify(a.region.bounds) === JSON.stringify(b.region.bounds)
  );
}
export const boundCurtain = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
export const curtainSide = (
  x: number,
  bounds: number[],
  curtain: number,
): "A" | "B" =>
  (x - bounds[0]) / (bounds[1] - bounds[0]) < boundCurtain(curtain) ? "A" : "B";
export function verifiedFinds(validation: ClassPoint[], rows: number[]) {
  const mistakes = new Set(
    validation.filter((row) => !row.correct).map((row) => row.row),
  );
  return [...new Set(rows)].filter(
    (row) => Number.isInteger(row) && mistakes.has(row),
  );
}
export type PlayDraft = {
  key: string;
  mode: PlayMode;
  found: number[];
  revealed: boolean;
};
export function readPlayDraft(raw: string | null): PlayDraft | null {
  try {
    const p = JSON.parse(raw || "null");
    if (
      !p ||
      typeof p.key !== "string" ||
      p.key.length > 50000 ||
      !["explore", "detective", "compare"].includes(p.mode) ||
      !Array.isArray(p.found) ||
      p.found.length > 300 ||
      p.found.some((v: number) => !Number.isInteger(v) || v < 0 || v > 299) ||
      typeof p.revealed !== "boolean"
    )
      return null;
    return {
      key: p.key,
      mode: p.mode,
      found: [...new Set<number>(p.found)],
      revealed: p.revealed,
    };
  } catch {
    return null;
  }
}
