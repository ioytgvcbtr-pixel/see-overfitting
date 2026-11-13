export const classModels = [
  {
    id: "logistic",
    name: "逻辑回归",
    hint: "用线性边界做分类；C越小，参数受到的约束越强。",
  },
  {
    id: "knn",
    name: "K近邻",
    hint: "由训练邻居投票。K很小时，边界可能跟随局部噪声弯折。",
  },
  {
    id: "svm",
    name: "RBF SVM",
    hint: "核函数形成非线性边界。γ控制影响范围，C控制误分惩罚；两者需要一起观察。",
  },
  {
    id: "tree",
    name: "决策树",
    hint: "沿特征方向逐次切分。深度增大可以细分区域，也可能记住噪声。",
  },
  {
    id: "forest",
    name: "随机森林",
    hint: "60棵树投票。集成能减少单棵树的波动，但仍需验证，不能保证总是最优。",
  },
] as const;
export const classDatasets = [
  {
    id: "moons",
    name: "交错月牙",
    type: "合成",
    hint: "弯曲与线性边界",
    glyph: "☾",
  },
  {
    id: "circles",
    name: "同心圆",
    type: "合成",
    hint: "邻域与影响范围",
    glyph: "◎",
  },
  {
    id: "xor",
    name: "交错象限",
    type: "合成",
    hint: "XOR与非线性",
    glyph: "⋈",
  },
  {
    id: "iris",
    name: "鸢尾花",
    type: "UCI · 150条",
    hint: "花瓣与品种混淆",
    glyph: "✿",
  },
  {
    id: "seeds",
    name: "小麦籽粒",
    type: "UCI · 210条",
    hint: "形态与类别重叠",
    glyph: "♧",
  },
] as const;
export type ClassModel = (typeof classModels)[number]["id"];
export type ClassDataset = (typeof classDatasets)[number]["id"];
export type ClassInput = {
  dataset: ClassDataset;
  model: ClassModel;
  seed: 42 | 43 | 44;
  noise: number;
  fraction: number;
  neighbors: number;
  c: number;
  gamma: number;
  depth: number;
  edits: { row: number; x: number; y: number }[];
};
export const classDefaults: ClassInput = {
  dataset: "moons",
  model: "logistic",
  seed: 42,
  noise: 0.15,
  fraction: 0.75,
  neighbors: 7,
  c: 1,
  gamma: 1,
  depth: 4,
  edits: [],
};
export const classC = [0.01, 0.1, 1, 10, 100];
export const classGamma = [0.03, 0.1, 0.3, 1, 3, 10];
export const classColors = ["#7546c8", "#087e75", "#b84b2c"];
export const classFills = ["#ece3fa", "#def1eb", "#f9e5d7"];
export type ClassPoint = {
  row: number;
  x: number;
  y: number;
  original_x: number;
  original_y: number;
  label: number;
  prediction: number;
  correct: boolean;
};
export type ClassResult = {
  parameters: ClassInput;
  dataset: {
    title: string;
    question: string;
    features: string[];
    classes: string[];
    synthetic: boolean;
    rows: number;
    source: string;
    citation?: string;
    license: string;
    transformation: string;
  };
  model_name: string;
  training: ClassPoint[];
  validation: ClassPoint[];
  metrics: {
    train_accuracy: number;
    validation_accuracy: number;
    balanced_accuracy: number;
    gap: number;
    mistakes: number;
  };
  confusion: number[][];
  region: { columns: number; rows: number; bounds: number[]; labels: number[] };
  fingerprint: string;
  validation_fingerprint: string;
  split: {
    training: number;
    training_pool: number;
    validation: number;
    test: number;
    test_sealed: boolean;
  };
  protocol: string;
  elapsed_ms: number;
};
export type ClassComparison = {
  models: {
    model: string;
    name: string;
    train_accuracy: number;
    validation_accuracy: number;
    balanced_accuracy: number;
  }[];
  best: string[];
  fingerprint: string;
  test_sealed: boolean;
  note: string;
};
export const classPercent = (v: number) => `${(v * 100).toFixed(1)}%`;
export const classKey = (p: ClassInput) =>
  JSON.stringify([
    p.dataset,
    p.model,
    p.seed,
    p.noise,
    p.fraction,
    p.neighbors,
    p.c,
    p.gamma,
    p.depth,
    [...p.edits].sort((a, b) => a.row - b.row).map((e) => [e.row, e.x, e.y]),
  ]);
export const classComparisonKey = (p: ClassInput) =>
  classKey({ ...p, model: "logistic" });
export function editClassPoint(
  p: ClassInput,
  row: number,
  x: number,
  y: number,
): ClassInput {
  if (
    ["iris", "seeds"].includes(p.dataset) ||
    !Number.isInteger(row) ||
    row < 0 ||
    row > 299 ||
    !Number.isFinite(x + y)
  )
    return p;
  return {
    ...p,
    edits: [
      ...p.edits.filter((e) => e.row !== row),
      { row, x: Math.max(-3, Math.min(3, x)), y: Math.max(-3, Math.min(3, y)) },
    ].sort((a, b) => a.row - b.row),
  };
}
export function readClassInput(raw: string | null): ClassInput | null {
  try {
    const p = JSON.parse(raw || "null");
    if (
      !p ||
      !classDatasets.some((d) => d.id === p.dataset) ||
      !classModels.some((m) => m.id === p.model) ||
      ![42, 43, 44].includes(p.seed)
    )
      return null;
    if (
      ![p.noise, p.fraction, p.neighbors, p.c, p.gamma, p.depth].every(
        Number.isFinite,
      ) ||
      p.noise < 0 ||
      p.noise > 0.45 ||
      p.fraction < 0.25 ||
      p.fraction > 1 ||
      !Number.isInteger(p.neighbors) ||
      p.neighbors < 1 ||
      p.neighbors > 21 ||
      !classC.includes(p.c) ||
      !classGamma.includes(p.gamma) ||
      !Number.isInteger(p.depth) ||
      p.depth < 1 ||
      p.depth > 12
    )
      return null;
    if (
      !Array.isArray(p.edits) ||
      p.edits.length > 180 ||
      new Set(p.edits.map((e: { row: number }) => e.row)).size !==
        p.edits.length ||
      p.edits.some(
        (e: { row: number; x: number; y: number }) =>
          !Number.isInteger(e.row) ||
          e.row < 0 ||
          e.row > 299 ||
          ![e.x, e.y].every(Number.isFinite) ||
          Math.abs(e.x) > 3 ||
          Math.abs(e.y) > 3,
      )
    )
      return null;
    if (["iris", "seeds"].includes(p.dataset) && p.edits.length) return null;
    return {
      dataset: p.dataset,
      model: p.model,
      seed: p.seed,
      noise: p.noise,
      fraction: p.fraction,
      neighbors: p.neighbors,
      c: p.c,
      gamma: p.gamma,
      depth: p.depth,
      edits: p.edits.map((e: { row: number; x: number; y: number }) => ({
        row: e.row,
        x: e.x,
        y: e.y,
      })),
    };
  } catch {
    return null;
  }
}
