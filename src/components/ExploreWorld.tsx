"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Play, FlaskConical } from "lucide-react";
import type { ConceptPanel } from "@/lib/concepts";
import type { ClassRecipeId } from "@/lib/exploration";
import { visualScenes, type VisualSceneId } from "@/lib/visual-scenes";
import SceneArtwork from "./SceneArtwork";
import HelpHint from "./HelpHint";
import ContinueChallenge from "./ContinueChallenge";
import type { ChallengeId } from "@/lib/island-progress";
import type { WorkspaceEntry } from "@/lib/workspace";

const places = [
  {
    id: "error",
    title: "离得远，为什么惩罚更重？",
    steps: [
      "上下拖动训练浮标",
      "调船帆与船身，改变模型预测",
      "比较残差、训练与验证误差",
    ],
  },
  {
    id: "sensitivity",
    title: "一个点，能牵动多远？",
    steps: ["移动同一枚训练路钉", "比较3阶A与可调B", "用变化RMS核对反应"],
  },
  {
    id: "regularization",
    title: "给模型一点约束，会怎样？",
    steps: ["转动α旋钮", "观察系数枝条与范数", "核对验证误差的变化"],
  },
  {
    id: "classification",
    title: "模型把谁看错了？",
    steps: [
      "先看包裹特征与区域图",
      "选门投递，核对预测和真实类别",
      "固定错分样本尝试救援",
    ],
  },
] as const;

export default function ExploreWorld({
  onConcept,
  onRecipe,
  onStudy,
  onContinue,
  onStart,
  continueEntry,
  onResumeEntry,
}: {
  onConcept: (panel: ConceptPanel) => void;
  onRecipe: (id: ClassRecipeId) => void;
  onStudy: () => void;
  onContinue: (id: ChallengeId) => void;
  onStart: () => Promise<void>;
  continueEntry: WorkspaceEntry | null;
  onResumeEntry: (entry: WorkspaceEntry) => Promise<void>;
}) {
  const [preview, setPreview] = useState<VisualSceneId>("classification");
  const [starting,setStarting]=useState(false),[startError,setStartError]=useState("");
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
        </div>
      </header>
      <div className="world-start-actions"><button className="button primary" disabled={starting} onClick={async()=>{setStarting(true);setStartError("");try{await onStart();}catch(e){setStartError((e as Error).message);}finally{setStarting(false);}}}><Play size={20}/>{starting?"正在准备":"开始学习"}</button><span>从误差湖开始，先猜一次，再亲手验证。</span><button className="button secondary" onClick={()=>document.querySelector('.world-atlas')?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><FlaskConical size={20}/>自由探索</button></div>
      {startError&&<p role="alert">{startError}</p>}
      <ContinueChallenge onContinue={onContinue} entry={continueEntry} onResumeEntry={onResumeEntry}/>
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
                  <span id={`world-hint-${row.id}`} className="sr-only">
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
          <h2>{place.title}</h2>
        </div>
        <HelpHint title={`${visual.name}怎么操作`}>
          <ol>
            {place.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>点击图案或按Enter直接进入。</p>
        </HelpHint>
      </aside>
      <section className="world-play-shelf" aria-labelledby="world-play-title">
        <div className="world-play-intro">
          <h2 id="world-play-title">把观察，变成一次发现。</h2>
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
        </p>
        <HelpHint title="从探索进入正式学习">
          <p>
            工作台依次完成预测、实验和新数据迁移。岛内探索不计正式成绩，课程完成状态由实际学习记录决定。
          </p>
        </HelpHint>
        <button className="text-button" onClick={onStudy}>
          进入学习工作台
          <ArrowRight size={16} />
        </button>
      </footer>
    </section>
  );
}
