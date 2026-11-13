"use client";
import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Compass,
  Search,
  Columns2,
  FlaskConical,
} from "lucide-react";
import type { ConceptPanel } from "@/lib/concepts";
import type { ClassRecipeId } from "@/lib/exploration";

const places = [
  {
    id: "error",
    name: "误差湖",
    title: "离得远，为什么惩罚更重？",
    subtitle: "拖一个点，看残差怎样变成平方。",
    steps: [
      "上下拖动训练点",
      "看选中点的残差方块",
      "移动参数标记，找更低的误差",
    ],
    action: "去误差湖动手",
    x: 19,
    y: 45,
    color: "lake",
  },
  {
    id: "sensitivity",
    name: "曲线山",
    title: "一个点，能牵动多远？",
    subtitle: "同一扰动，两条曲线会有不同反应。",
    steps: [
      "把同一个训练点拖远",
      "比较3阶与高阶的变化带",
      "调节约束，再核对变化RMS",
    ],
    action: "去曲线山观察",
    x: 49,
    y: 22,
    color: "mountain",
  },
  {
    id: "regularization",
    name: "约束花园",
    title: "给模型一点约束，会怎样？",
    subtitle: "转动α拨盘，观察系数与拟合的取舍。",
    steps: [
      "从较弱的α开始",
      "点击正则化路径的不同位置",
      "同时观察系数、训练与验证误差",
    ],
    action: "去花园调一调",
    x: 47,
    y: 77,
    color: "garden",
  },
  {
    id: "classification",
    name: "边界森林",
    title: "模型把谁看错了？",
    subtitle: "穿过分类边界，找出被误判的样本。",
    steps: [
      "辨认空心的验证点",
      "寻找类别与底色不一致的位置",
      "检查你的发现，再揭晓全图",
    ],
    action: "开始错分侦探",
    x: 80,
    y: 49,
    color: "forest",
  },
] as const;

export default function ExploreMap({
  onConcept,
  onRecipe,
  onStudy,
}: {
  onConcept: (panel: ConceptPanel) => void;
  onRecipe: (id: ClassRecipeId) => void;
  onStudy: () => void;
}) {
  const [selected, setSelected] =
    useState<(typeof places)[number]["id"]>("classification");
  const place = places.find((row) => row.id === selected)!;
  return (
    <section className="explore-home" aria-label="模型探索地图">
      <header className="explore-heading">
        <div>
          <span className="explore-label">
            <Compass size={17} aria-hidden="true" />
            机器学习，动手才看得见
          </span>
          <h1>带一个问题，动手找答案。</h1>
          <p>选一座岛，拖动、寻找、对照。让图形回答你的“如果”。</p>
        </div>
        <span className="explore-note">
          自由探索
          <br />
          真实计算
        </span>
      </header>
      <div className="explore-main">
        <div className="explore-map" role="group" aria-label="选择要探索的问题">
          <svg
            className="explore-landscape"
            viewBox="0 0 1000 560"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="map-dots"
                width="26"
                height="26"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="3" cy="3" r="1" fill="#b9acc9" opacity=".36" />
              </pattern>
            </defs>
            <rect width="1000" height="560" fill="url(#map-dots)" />
            <path
              d="M180 255Q270 85 490 125Q720 50 805 275Q760 470 475 430Q230 515 180 255"
              fill="none"
              stroke="#c8b9d6"
              strokeWidth="3"
              strokeDasharray="5 10"
            />
            <path
              d="M60 210Q65 140 160 151Q254 136 295 214Q331 295 238 326Q126 369 68 302Q25 270 60 210"
              fill="#dceee8"
              stroke="#b4d5c8"
              strokeWidth="2"
            />
            <path
              d="M356 133Q375 42 489 35Q588 29 634 111Q663 169 582 200Q469 250 384 208Q336 184 356 133"
              fill="#e6def5"
              stroke="#cab8e2"
              strokeWidth="2"
            />
            <path
              d="M341 425Q325 354 417 334Q511 294 576 354Q659 423 594 485Q525 539 413 507Q351 488 341 425"
              fill="#f7e6c8"
              stroke="#e5cea2"
              strokeWidth="2"
            />
            <path
              d="M685 246Q695 167 791 174Q890 141 945 225Q985 307 905 352Q805 399 719 348Q671 313 685 246"
              fill="#dfeadc"
              stroke="#b9d2b1"
              strokeWidth="2"
            />
            <g fill="none" stroke="#8ebcb0" strokeWidth="2" opacity=".6">
              <path d="M87 262Q167 208 269 269" />
              <path d="M89 279Q167 225 266 286" />
              <path d="M97 296Q169 244 251 300" />
            </g>
            <g fill="none" stroke="#a48bc7" strokeWidth="2" opacity=".6">
              <path d="M381 149L446 76L482 120L531 66L608 150" />
              <path d="M399 163L446 111L482 150L531 106L587 168" />
            </g>
            <g fill="#d7b968" opacity=".65">
              <circle cx="385" cy="428" r="5" />
              <circle cx="569" cy="405" r="5" />
              <circle cx="541" cy="471" r="5" />
              <circle cx="417" cy="478" r="4" />
            </g>
            <g fill="#a7c5a1" opacity=".8">
              <path d="M728 306l18-48 18 48z" />
              <path d="M885 237l20-52 20 52z" />
              <path d="M864 333l17-45 17 45z" />
            </g>
            <path
              d="M310 384q16-33 33-6q-17 9-33 6M667 101q20-36 38-6q-20 8-38 6"
              fill="#d8c8e8"
            />
          </svg>
          {places.map((row) => (
            <button
              key={row.id}
              className={`explore-spot ${row.color}`}
              style={{ left: `${row.x}%`, top: `${row.y}%` }}
              aria-pressed={selected === row.id}
              onClick={() => setSelected(row.id)}
            >
              <span className="spot-pin" aria-hidden="true" />
              <strong>{row.name}</strong>
              <span>
                {row.id === "error"
                  ? "残差与损失"
                  : row.id === "sensitivity"
                    ? "扰动与过拟合"
                    : row.id === "regularization"
                      ? "系数与正则化"
                      : "类别与判断"}
              </span>
            </button>
          ))}
          <div className="map-companion">
            <Image
              src="/illustrations/fitlab-guide-v1.png"
              alt=""
              width={92}
              height={84}
              sizes="92px"
            />
            <span>你想先弄懂哪一个？</span>
          </div>
        </div>
        <aside className={`explore-question ${place.color}`} aria-live="polite">
          <span className="question-place">{place.name}</span>
          <h2>{place.title}</h2>
          <p>{place.subtitle}</p>
          <ol>
            {place.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <button
            className="button primary"
            onClick={() =>
              place.id === "classification"
                ? onRecipe("detective")
                : onConcept(place.id)
            }
          >
            {place.action}
            <ArrowRight size={17} />
          </button>
          <small>可以随时切换问题；探索不计正式课程成绩。</small>
        </aside>
      </div>
      <div className="explore-playlist">
        <div>
          <h2>换一种玩法</h2>
          <p>同一份证据，用不同方式发现。</p>
        </div>
        <button onClick={() => onRecipe("detective")}>
          <Search size={23} />
          <span>
            <strong>错分侦探</strong>
            <small>先寻找，再揭晓</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <button onClick={() => onRecipe("duel")}>
          <Columns2 size={23} />
          <span>
            <strong>边界掀幕</strong>
            <small>定格A，拖幕看B</small>
          </span>
          <ArrowRight size={17} />
        </button>
      </div>
      <footer className="explore-study">
        <FlaskConical size={22} />
        <p>
          <strong>想检验自己是否真的理解？</strong>
          <span>回到学习工作台，完成预测、实验与新数据迁移。</span>
        </p>
        <button className="text-button" onClick={onStudy}>
          进入学习工作台
          <ArrowRight size={16} />
        </button>
      </footer>
    </section>
  );
}
