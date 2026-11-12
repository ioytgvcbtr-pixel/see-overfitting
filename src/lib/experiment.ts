export type SceneId = "complexity" | "samples" | "regularization";
export type Parameters = {
  scene: SceneId;
  degree: number;
  samples: number;
  noise: number;
  alpha: number;
  seed: number;
};
export type Point = { x: number; y: number };
export type Result = {
  parameters: Parameters;
  metrics: { train_mse: number; validation_mse: number; gap: number };
  diagnosis: { label: string; tone: string; description: string };
  train: Point[];
  validation: Point[];
  curve: { x: number; fit: number; truth: number }[];
  experiment_id: string;
  data_fingerprint: string;
  elapsed_ms: number;
  split: {
    training: number;
    validation: number;
    test: number;
    test_sealed: boolean;
  };
  method: string;
};
export type SavedRecord = {
  id: number;
  title: string;
  note: string;
  prediction: string;
  created_at: string;
  result: Result;
};
export type Sweep = {
  points: { degree: number; train_mse: number; validation_mse: number }[];
  best_degree: number;
};
export type Coach = {
  mode: "online" | "rules";
  model: string | null;
  content: string;
  notice: string;
  evidence: { fingerprint: string };
};
export type FinalResult = {
  test_mse: number;
  test_samples: number;
  experiment_id: string;
  note: string;
};

export const scenes: {
  id: SceneId;
  number: string;
  title: string;
  short: string;
  description: string;
  tag: string;
  task: string;
  question: string;
  options: string[];
  answer: number;
  reason: string;
  defaults: Parameters;
}[] = [
  {
    id: "complexity",
    number: "01",
    title: "模型复杂度与泛化",
    short: "模型复杂度",
    tag: "从现象到直觉",
    description: "一条曲线，多少复杂度才刚刚好？让数据给出答案。",
    task: "分别尝试 1、4、15 阶模型，记录并比较验证误差。",
    question: "如果训练误差不断下降，验证误差会怎样？",
    options: ["一定同步下降", "可能先下降，再上升", "始终保持不变"],
    answer: 1,
    reason:
      "更复杂的模型可能开始拟合噪声。要用独立于训练的验证数据比较，而不是只看训练误差。",
    defaults: {
      scene: "complexity",
      degree: 4,
      samples: 12,
      noise: 0.22,
      alpha: 0.00000001,
      seed: 42,
    },
  },
  {
    id: "samples",
    number: "02",
    title: "样本数量与噪声",
    short: "样本与噪声",
    tag: "理解数据的力量",
    description: "数据多一点，模型就一定更好吗？一次只改变一个条件。",
    task: "保持复杂度和噪声不变，把样本量从 12 增加到 120。",
    question: "比较不同样本量时，应该怎样处理验证集？",
    options: ["每次随机换一批", "只挑误差最低的数据", "保持相同验证数据与分布"],
    answer: 2,
    reason:
      "固定验证集能让样本量对比更公平。更多样本通常有帮助，但单次结果仍受采样与噪声影响。",
    defaults: {
      scene: "samples",
      degree: 15,
      samples: 12,
      noise: 0.22,
      alpha: 0.00000001,
      seed: 42,
    },
  },
  {
    id: "regularization",
    number: "03",
    title: "正则化的平衡艺术",
    short: "正则化",
    tag: "给复杂度一点约束",
    description: "保持模型容量，用一个系数改变它学习的方式。",
    task: "固定 15 阶模型，逐步增加正则强度，观察验证表现。",
    question: "不断增加正则化强度，是否总能改善泛化？",
    options: ["是，越强越好", "否，过强也可能欠拟合", "正则化不会影响模型"],
    answer: 1,
    reason:
      "正则化约束系数，有助于减少对噪声的拟合；但过强会限制表达能力，应根据验证结果选择。",
    defaults: {
      scene: "regularization",
      degree: 15,
      samples: 12,
      noise: 0.22,
      alpha: 0.00000001,
      seed: 42,
    },
  },
];

export const quizzes = {
  complexity: {
    question:
      "两组模型中，A的训练MSE更低，B的验证MSE更低。接下来更合理的做法是什么？",
    options: [
      "直接选择训练误差最低的A",
      "优先考察B，并保留独立测试作最后评估",
      "反复查看测试误差，选最低的一组",
    ],
    answer: 1,
    reason: "模型选择依赖验证表现。测试集应留到最后，避免它也参与调参。",
  },
  samples: {
    question:
      "增加样本后，这一次验证误差略有上升。能否因此断言“数据越多越差”？",
    options: [
      "可以，这次实验已经证明",
      "不可以，应保持条件一致，并用多个种子检查稳定性",
      "可以，只需忽略噪声因素",
    ],
    answer: 1,
    reason:
      "单次采样的波动不能支持普遍结论。先检查对比条件，再复核多个独立种子。",
  },
  regularization: {
    question: "强正则化让训练与验证误差都明显升高，你会怎样调整？",
    options: [
      "继续增大正则化，直到两者相等",
      "把测试集加入训练",
      "尝试减小正则化，并比较验证误差",
    ],
    answer: 2,
    reason: "过强约束可能导致欠拟合。需要在表达能力与约束之间寻找合适平衡。",
  },
};

export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok)
    throw new Error(
      response.status === 502
        ? "实验服务尚未启动，请检查后端服务。"
        : `请求未完成（${response.status}），请重试。`,
    );
  return response.json();
}

export function metric(value: number) {
  return Math.abs(value) >= 1000 ? value.toExponential(2) : value.toFixed(4);
}
