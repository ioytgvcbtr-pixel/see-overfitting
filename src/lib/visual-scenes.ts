import type { SceneId } from "./experiment";
import type { PlayMode } from "./exploration";

export const visualScenes = {
  error: {
    src: "/illustrations/world-v09/island-error-v1.png",
    name: "误差湖",
    topic: "残差与平方损失",
    verb: "量一量误差",
    hint: "拖动一个点，看距离怎样变成损失。",
  },
  sensitivity: {
    src: "/illustrations/world-v09/island-sensitivity-v1.png",
    name: "曲线山",
    topic: "复杂度与样本扰动",
    verb: "追踪曲线变化",
    hint: "同一个扰动，会牵动两条怎样的曲线？",
  },
  regularization: {
    src: "/illustrations/world-v09/island-regularization-v1.png",
    name: "约束花园",
    topic: "系数与正则化",
    verb: "转动约束旋钮",
    hint: "约束变强时，拟合与泛化如何取舍？",
  },
  classification: {
    src: "/illustrations/world-v09/island-classification-v1.png",
    name: "边界森林",
    topic: "类别、边界与错分",
    verb: "开始错分侦探",
    hint: "穿过分类边界，找出被模型看错的点。",
  },
} as const;
export type VisualSceneId = keyof typeof visualScenes;
export const lessonVisual: Record<SceneId, VisualSceneId> = {
  complexity: "sensitivity",
  samples: "error",
  regularization: "regularization",
};
export const playVisuals: Record<
  PlayMode,
  { src: string; description: string }
> = {
  explore: {
    src: visualScenes.classification.src,
    description: "改参数，观察模型",
  },
  detective: {
    src: "/illustrations/fitlab-guide-v1.png",
    description: "先寻找，再揭晓",
  },
  compare: { src: visualScenes.sensitivity.src, description: "定格A，拖幕看B" },
};
