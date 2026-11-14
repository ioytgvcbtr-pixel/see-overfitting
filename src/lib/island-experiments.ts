import type { ConceptResult } from "./concepts";
import type { ClassResult } from "./classification";

export function railValue(
  position: number,
  start: number,
  end: number,
  min: number,
  max: number,
  step: number,
) {
  if (
    ![position, start, end, min, max, step].every(Number.isFinite) ||
    end === start ||
    step <= 0
  )
    return min;
  const t = Math.max(0, Math.min(1, (position - start) / (end - start)));
  return Math.max(
    min,
    Math.min(max, min + Math.round((t * (max - min)) / step) * step),
  );
}
export function dialIndex(x: number, y: number, cx: number, cy: number) {
  const angle = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  return railValue(angle, -135, 135, 0, 7, 1);
}
export function direction(current: number, before: number) {
  const tolerance = 1e-7 * Math.max(1, Math.abs(current), Math.abs(before));
  return Math.abs(current - before) <= tolerance
    ? "same"
    : current < before
      ? "lower"
      : "higher";
}
export const directionChoices = [
  { id: "lower", label: "验证误差更低" },
  { id: "higher", label: "验证误差更高" },
  { id: "same", label: "基本相同" },
];
export type QuestObservation = {
  ready: boolean;
  reason: string;
  question: string;
  correct: string;
  choices: { id: string; label: string }[];
  evidence: Record<string, number>;
  progress?: number;
};
export function observeQuest(
  start: ConceptResult,
  current: ConceptResult,
): QuestObservation {
  const p = current.parameters,
    s = start.parameters;
  const base: QuestObservation = {
    ready: false,
    reason: "",
    question: "与任务起点相比，验证误差怎样变化？",
    correct: "",
    choices: directionChoices,
    evidence: {},
  };
  if (
    p.panel !== s.panel ||
    p.seed !== s.seed ||
    p.samples !== s.samples ||
    p.noise !== s.noise ||
    current.validation_fingerprint !== start.validation_fingerprint
  )
    return { ...base, reason: "样本条件已改变，请重新布置任务。" };
  if (p.panel === "sensitivity" && current.pairs) {
    const [a, b] = current.pairs;
    return {
      ...base,
      ready: (current.label_shift_rms ?? 0) >= 0.02,
      reason: "先上下移动一枚训练路钉，让两条路回应同一个扰动。",
      question: "这次扰动后，哪条路的整体变化RMS更大？",
      choices: [
        { id: "a", label: "参考A更大" },
        { id: "b", label: "观察B更大" },
        { id: "same", label: "基本相同" },
      ],
      correct:
        direction(b.shift_rms, a.shift_rms) === "higher"
          ? "b"
          : direction(b.shift_rms, a.shift_rms) === "lower"
            ? "a"
            : "same",
      evidence: {
        a_shift_rms: a.shift_rms,
        b_shift_rms: b.shift_rms,
        label_shift_rms: current.label_shift_rms ?? 0,
      },
    };
  }
  if (current.data_fingerprint !== start.data_fingerprint)
    return {
      ...base,
      reason: "本任务保持训练样本不变；请还原样本或重新布置。",
    };
  if (p.panel === "error" && current.linear && start.linear) {
    const gap = start.linear.train_mse - start.linear.optimum.train_mse;
    const progress =
      gap > 1e-10
        ? Math.max(
            0,
            Math.min(
              1,
              (start.linear.train_mse - current.linear.train_mse) / gap,
            ),
          )
        : 0;
    return {
      ...base,
      ready: gap > 1e-10 && progress >= 0.75,
      progress,
      reason: "调整斜率与截距，消除至少75%可减少的训练误差；浮标保持不动。",
      correct: direction(
        current.linear.validation_mse,
        start.linear.validation_mse,
      ),
      evidence: {
        before_train_mse: start.linear.train_mse,
        train_mse: current.linear.train_mse,
        optimum_train_mse: current.linear.optimum.train_mse,
        before_validation_mse: start.linear.validation_mse,
        validation_mse: current.linear.validation_mse,
        avoidable_error_removed: progress,
      },
    };
  }
  if (
    p.panel === "regularization" &&
    current.regularization &&
    start.regularization
  ) {
    if (p.degree !== s.degree)
      return {
        ...base,
        reason: "本任务保持模型阶数不变；恢复阶数或重新布置。",
      };
    const before = start.regularization.current,
      now = current.regularization.current;
    return {
      ...base,
      ready: p.alpha > s.alpha && now.weight_norm <= 0.8 * before.weight_norm,
      reason: "增大α，让系数范数降到起点的80%以下，再核对验证表现。",
      correct: direction(now.validation_mse, before.validation_mse),
      evidence: {
        before_weight_norm: before.weight_norm,
        weight_norm: now.weight_norm,
        before_validation_mse: before.validation_mse,
        validation_mse: now.validation_mse,
      },
    };
  }
  return { ...base, reason: "正在等待对应概念的实算结果。" };
}
export function rescueObservation(
  before: ClassResult,
  current: ClassResult,
  row: number,
) {
  const original = before.validation.find((p) => p.row === row),
    now = current.validation.find((p) => p.row === row);
  if (
    !original ||
    !now ||
    original.correct ||
    before.fingerprint !== current.fingerprint ||
    before.validation_fingerprint !== current.validation_fingerprint
  )
    return null;
  return {
    fixed: now.correct,
    before_prediction: original.prediction,
    prediction: now.prediction,
    label: now.label,
    before_accuracy: before.metrics.validation_accuracy,
    accuracy: current.metrics.validation_accuracy,
  };
}
export function deliveryGate(x: number, width: number, count: number) {
  return Math.max(0, Math.min(count - 1, Math.floor((x / width) * count)));
}
