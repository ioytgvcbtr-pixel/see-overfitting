"use client";
import { Check, ChevronRight, Lightbulb } from "lucide-react";
import type { Parameters } from "@/lib/experiment";
import { metric } from "@/lib/experiment";
import {
  lowestObserved,
  type LessonGuide,
  type ObservationSet,
} from "@/lib/learning-guide";

export function LearningMission({
  guide,
  params,
  observations,
  onSelect,
}: {
  guide: LessonGuide;
  params: Parameters;
  observations: ObservationSet;
  onSelect: (value: number) => void;
}) {
  const records =
    guide.conditionKey === observations.conditionKey ? observations.items : {};
  return (
    <section className="learning-mission" aria-label="本次学习任务">
      <div className="mission-question">
        <span className="mission-symbol">
          <Lightbulb size={21} />
        </span>
        <div>
          <strong>{guide.title}</strong>
          <p>{guide.prompt}</p>
        </div>
      </div>
      <div className="mission-steps">
        {guide.steps.map((step, index) => (
          <button
            key={step.value}
            className={params[guide.control] === step.value ? "selected" : ""}
            aria-pressed={params[guide.control] === step.value}
            onClick={() => onSelect(step.value)}
          >
            <span className="mission-number">
              {records[String(step.value)] ? <Check size={14} /> : index + 1}
            </span>
            <span>
              {step.label}
              <small>{step.detail}</small>
            </span>
            {index < 2 && (
              <ChevronRight className="mission-chevron" size={14} />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

export function ObservationBoard({
  guide,
  observations,
  onSelect,
}: {
  guide: LessonGuide;
  observations: ObservationSet;
  onSelect: (value: number) => void;
}) {
  const records =
    guide.conditionKey === observations.conditionKey ? observations.items : {};
  const count = guide.steps.filter(
    (step) => records[String(step.value)],
  ).length;
  const best = lowestObserved(guide, observations);
  return (
    <section className="observation-board">
      <div className="observation-heading">
        <h2>把刚才的结果放在一起看</h2>
        <span>已观察 {count}/3 个条件</span>
      </div>
      <div className="observation-grid">
        {guide.steps.map((step) => {
          const result = records[String(step.value)];
          return (
            <button
              className={`observation-item ${result ? "observed" : ""}`}
              key={step.value}
              onClick={() => onSelect(step.value)}
            >
              <div>
                <strong>{step.label}</strong>
                {result ? <Check size={15} /> : <ChevronRight size={15} />}
              </div>
              {result ? (
                <dl>
                  <div>
                    <dt>训练误差</dt>
                    <dd>{metric(result.metrics.train_mse)}</dd>
                  </div>
                  <div>
                    <dt>验证误差</dt>
                    <dd>{metric(result.metrics.validation_mse)}</dd>
                  </div>
                </dl>
              ) : (
                <p>点击观察这个条件，记录真实计算结果。</p>
              )}
            </button>
          );
        })}
      </div>
      <p className="observation-note" aria-live="polite">
        {count === 3 && best
          ? `这三次对照中，${best.label}的验证误差最低。结论只对应当前数据条件。`
          : "依次观察三个条件，重点比较验证误差。修改其他数据条件时，本轮对照会重新开始。"}
      </p>
    </section>
  );
}

export function MetricHelp({
  kind = "mse",
  unit,
}: {
  kind?: "mse" | "rmse";
  unit?: string;
}) {
  return (
    <details className="metric-help">
      <summary>这些误差和指标怎么看？</summary>
      <div>
        <p>
          <strong>训练误差：</strong>模型在用于学习的数据上表现怎样。
          <strong>验证误差：</strong>换一批数据后的表现，用来比较参数。
        </p>
        <p>
          {kind === "mse"
            ? "MSE是预测值与真实值之差的平方的平均值。"
            : "RMSE是均方误差的平方根。"}
          数值越小，当前预测越接近真实值。
          {unit
            ? `这里的误差单位是${unit}；不同数据集的绝对误差不直接排名。`
            : ""}
        </p>
        <p>
          {kind === "rmse"
            ? "R²衡量模型对验证数据变化的解释程度，1为完全拟合，也可能为负。"
            : ""}
          训练误差低，不代表验证表现一定好。独立测试应留到完成选参后再查看。
        </p>
      </div>
    </details>
  );
}
