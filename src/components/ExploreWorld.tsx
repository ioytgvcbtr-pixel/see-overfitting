"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Compass, Play, FlaskConical } from "lucide-react";
import type { ConceptPanel } from "@/lib/concepts";
import type { ClassRecipeId } from "@/lib/exploration";
import { visualScenes, type VisualSceneId } from "@/lib/visual-scenes";
import SceneArtwork from "./SceneArtwork";

const places = [
  {
    id: "error",
    title: "离得远，为什么惩罚更重？",
    steps: [
      "上下拖动训练点",
      "看选中点的残差方块",
      "移动参数标记，找更低的误差",
    ],
  },
  {
    id: "sensitivity",
    title: "一个点，能牵动多远？",
    steps: [
      "把同一个训练点拖远",
      "比较3阶与高阶变化",
      "调节约束，再核对变化RMS",
    ],
  },
  {
    id: "regularization",
    title: "给模型一点约束，会怎样？",
    steps: ["从较弱的α开始", "点击正则化路径", "一起观察系数与验证误差"],
  },
  {
    id: "classification",
    title: "模型把谁看错了？",
    steps: [
      "辨认空心验证点",
      "找出类别与底色不一致的位置",
      "检查发现，再揭晓全图",
    ],
  },
] as const;

export default function ExploreWorld({
  onConcept,
  onRecipe,
  onStudy,
}: {
  onConcept: (panel: ConceptPanel) => void;
  onRecipe: (id: ClassRecipeId) => void;
  onStudy: () => void;
}) {
  const [preview, setPreview] = useState<VisualSceneId>("classification");
  const place = places.find((p) => p.id === preview)!;
  const visual = visualScenes[preview];
  function enter(id: VisualSceneId) {
    if (id === "classification") onRecipe("detective");
    else onConcept(id);
  }
  return (
    <section className="illustrated-world" aria-label="模型探索地图">
      <header className="world-heading">
        <div>
          <span className="world-subject">
            <Compass size={17} aria-hidden="true" />
            机器学习可视化探索
          </span>
          <h1>下一站，模型群岛。</h1>
          <p>从误差、过拟合到分类边界，选一处场景，亲手看见规律。</p>
        </div>
        <div className="world-host">
          <Image
            src="/illustrations/fitlab-guide-v1.png"
            alt=""
            width={82}
            height={75}
            sizes="82px"
          />
          <span>今天，想弄懂哪一个？</span>
        </div>
      </header>
      <div
        className="world-atlas"
        role="group"
        aria-label="点击场景直接开始探索"
      >
        <svg
          className="world-trails"
          viewBox="0 0 1200 320"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M80 235Q215 350 405 220T755 230T1120 200"
            fill="none"
            stroke="#c5b3d5"
            strokeWidth="3"
            strokeDasharray="3 11"
          />
          <path
            d="M18 106Q88 77 125 104Q180 66 220 106M970 45Q1020 15 1070 44Q1125 12 1170 49"
            fill="none"
            stroke="#fff"
            strokeWidth="18"
            strokeLinecap="round"
            opacity=".55"
          />
        </svg>
        <div className="world-scene-grid">
          {places.map((row, index) => {
            const art = visualScenes[row.id];
            return (
              <button
                className={`world-scene scene-${row.id}`}
                key={row.id}
                aria-label={`进入${art.name}，${art.topic}`}
                aria-describedby={`world-hint-${row.id}`}
                data-preview={preview === row.id}
                onFocus={() => setPreview(row.id)}
                onPointerEnter={() => setPreview(row.id)}
                onClick={() => enter(row.id)}
              >
                <div className="world-scene-picture">
                  <SceneArtwork scene={row.id} eager preload={index === 0} />
                </div>
                <div className="world-scene-caption">
                  <span className="world-topic">{art.topic}</span>
                  <strong>{art.name}</strong>
                  <span
                    id={`world-hint-${row.id}`}
                    className="world-scene-hint"
                  >
                    {art.hint}
                  </span>
                  <span className="world-enter">
                    <Play size={13} fill="currentColor" aria-hidden="true" />
                    {art.verb}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <aside className="world-preview" aria-label="场景玩法预告">
        <div className="world-preview-question" aria-live="polite">
          <span>{visual.name} · 玩法预告</span>
          <h2>{place.title}</h2>
        </div>
        <ol>
          {place.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <span className="world-preview-note">点击图案或按Enter进入</span>
      </aside>
      <section className="world-play-shelf" aria-labelledby="world-play-title">
        <div className="world-play-intro">
          <h2 id="world-play-title">把观察，变成一次发现。</h2>
          <p>换一种方式，同样用证据回答。</p>
        </div>
        <button className="world-mission" onClick={() => onRecipe("detective")}>
          <div className="world-mission-art mascot">
            <Image
              src="/illustrations/fitlab-guide-v1.png"
              alt=""
              fill
              sizes="100px"
              style={{ objectFit: "contain" }}
            />
          </div>
          <span>
            <strong>错分侦探</strong>
            <small>找到被模型看错的验证点</small>
          </span>
          <ArrowRight size={18} />
        </button>
        <button className="world-mission" onClick={() => onRecipe("duel")}>
          <SceneArtwork
            scene="sensitivity"
            className="world-mission-art"
            sizes="140px"
          />
          <span>
            <strong>边界掀幕</strong>
            <small>定格A，对照另一种判断</small>
          </span>
          <ArrowRight size={18} />
        </button>
      </section>
      <footer className="world-study">
        <FlaskConical size={22} />
        <p>
          <strong>准备检验自己的理解？</strong>
          <span>
            进入学习工作台，完成预测、实验与新数据迁移。探索玩法不计正式课程成绩。
          </span>
        </p>
        <button className="text-button" onClick={onStudy}>
          进入学习工作台
          <ArrowRight size={16} />
        </button>
      </footer>
    </section>
  );
}
