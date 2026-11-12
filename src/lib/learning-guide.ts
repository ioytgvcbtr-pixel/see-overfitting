import type { Parameters, Result } from "./experiment";

export type GuideControl = "degree" | "samples" | "alpha";
export type GuideStep = { value: number; label: string; detail: string };
export type LessonGuide = {
  control: GuideControl;
  title: string;
  prompt: string;
  steps: GuideStep[];
  conditionKey: string;
};

export function lessonGuide(params: Parameters): LessonGuide {
  const control: GuideControl =
    params.scene === "samples"
      ? "samples"
      : params.scene === "regularization"
        ? "alpha"
        : "degree";
  const fixed = {
    scene: params.scene,
    degree: params.degree,
    samples: params.samples,
    noise: params.noise,
    alpha: params.alpha,
    seed: params.seed,
  };
  const conditionKey = JSON.stringify({ ...fixed, [control]: null });
  if (control === "samples")
    return {
      control,
      conditionKey,
      title: "增加样本，验证误差会怎样变化？",
      prompt: "保持模型和噪声不变，依次观察三个样本量。",
      steps: [
        { value: 12, label: "12 个样本", detail: "较少数据" },
        { value: 60, label: "60 个样本", detail: "增加数据" },
        { value: 120, label: "120 个样本", detail: "更多数据" },
      ],
    };
  if (control === "alpha")
    return {
      control,
      conditionKey,
      title: "给复杂模型加一点约束，会发生什么？",
      prompt: "保持数据与模型阶数不变，依次增加正则化强度。",
      steps: [
        { value: 1e-8, label: "弱约束", detail: "α = 1e-8" },
        { value: 0.01, label: "中等约束", detail: "α = 0.01" },
        { value: 1, label: "强约束", detail: "α = 1" },
      ],
    };
  return {
    control,
    conditionKey,
    title: "模型越复杂，遇到新数据就越准吗？",
    prompt: "保持数据条件不变，对照 1、4、15 阶模型。",
    steps: [
      { value: 1, label: "1 阶模型", detail: "简单模型" },
      { value: 4, label: "4 阶模型", detail: "增加复杂度" },
      { value: 15, label: "15 阶模型", detail: "更复杂的模型" },
    ],
  };
}

export type ObservationSet = {
  conditionKey: string;
  items: Record<string, Result>;
};
export function recordObservation(
  previous: ObservationSet,
  result: Result,
): ObservationSet {
  const guide = lessonGuide(result.parameters);
  const value = result.parameters[guide.control];
  if (!guide.steps.some((step) => step.value === value)) return previous;
  const items =
    previous.conditionKey === guide.conditionKey ? previous.items : {};
  return {
    conditionKey: guide.conditionKey,
    items: { ...items, [String(value)]: result },
  };
}

export function lowestObserved(
  guide: LessonGuide,
  observations: ObservationSet,
): GuideStep | null {
  if (guide.conditionKey !== observations.conditionKey) return null;
  const available = guide.steps.filter(
    (step) => observations.items[String(step.value)],
  );
  if (!available.length) return null;
  return available.reduce((best, step) =>
    observations.items[String(step.value)].metrics.validation_mse <
    observations.items[String(best.value)].metrics.validation_mse
      ? step
      : best,
  );
}
