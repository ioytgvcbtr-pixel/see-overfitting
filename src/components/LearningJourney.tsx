"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Target,
  RefreshCw,
} from "lucide-react";
import type { LessonGuide } from "@/lib/learning-guide";
import type { LearningAttempt } from "@/lib/learning-session";
import type { Parameters } from "@/lib/experiment";

export function JourneySteps({ attempt }: { attempt: LearningAttempt | null }) {
  const current = !attempt ? 0 : attempt.stage === "experiment" ? 1 : 2;
  return (
    <ol className="journey-steps" aria-label="学习流程">
      {["提交预测", "三步实验", "迁移验证"].map((text, i) => (
        <li
          key={text}
          className={
            attempt?.stage === "complete"
              ? "done"
              : i === current
                ? "active"
                : i < current
                  ? "done"
                  : ""
          }
        >
          <span>
            {i < current || attempt?.stage === "complete" ? (
              <Check size={14} />
            ) : (
              i + 1
            )}
          </span>
          {text}
          {i < 2 && <ArrowRight size={14} />}
        </li>
      ))}
    </ol>
  );
}

export function PredictionGate({
  guide,
  parameters,
  ready,
  working,
  onSubmit,
}: {
  guide: LessonGuide;
  parameters: Parameters;
  ready: boolean;
  working: boolean;
  onSubmit: (
    choice: number,
    confidence: number,
    reason: string,
  ) => Promise<void>;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  return (
    <section
      className="prediction-gate panel"
      aria-labelledby="prediction-title"
    >
      <div className="prediction-gate-intro">
        <span className="gate-symbol">
          <Target size={30} />
        </span>
        <div>
          <h2 id="prediction-title">先留下你的判断，再让实验回答</h2>
          <p>{guide.prompt}你预测哪个条件的验证误差最低？</p>
        </div>
      </div>
      <div className="prediction-conditions" aria-label="本轮固定条件">
        <span>固定条件</span>
        {guide.control !== "degree" && <span>{parameters.degree} 阶模型</span>}
        {guide.control !== "samples" && (
          <span>{parameters.samples} 个训练样本</span>
        )}
        <span>噪声 σ = {parameters.noise}</span>
        {guide.control !== "alpha" && (
          <span>
            α ={" "}
            {parameters.alpha < 0.001
              ? parameters.alpha.toExponential(0)
              : parameters.alpha}
          </span>
        )}
        <span>随机种子 {parameters.seed}</span>
      </div>
      <p className="prediction-hint">
        验证误差衡量模型在未参与训练的数据上的表现，越小越好。可以先猜，再用实验修正直觉。
      </p>
      <div
        className="prediction-choice-grid"
        role="radiogroup"
        aria-label="本轮预测"
      >
        {guide.steps.map((step, i) => (
          <button
            key={step.value}
            role="radio"
            disabled={working || !ready}
            tabIndex={
              choice === null ? (i === 0 ? 0 : -1) : choice === i ? 0 : -1
            }
            aria-checked={choice === i}
            className={choice === i ? "selected" : ""}
            onClick={() => setChoice(i)}
            onKeyDown={(event) => {
              if (
                !["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              const next =
                (i +
                  (event.key === "ArrowRight" || event.key === "ArrowDown"
                    ? 1
                    : 2)) %
                3;
              setChoice(next);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>("button")
                [next]?.focus();
            }}
          >
            <span className="radio-circle">{choice === i && <span />}</span>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </button>
        ))}
      </div>
      <fieldset className="confidence-options" disabled={working || !ready}>
        <legend>你对这个判断有多确定？</legend>
        {["先试着猜", "有一些依据", "比较确定"].map((text, i) => (
          <label key={text}>
            <input
              type="radio"
              name="prediction-confidence"
              checked={confidence === i + 1}
              onChange={() => setConfidence(i + 1)}
            />
            {text}
          </label>
        ))}
      </fieldset>
      <label className="prediction-reason">
        判断依据（选填）
        <textarea
          value={reason}
          maxLength={500}
          rows={2}
          disabled={working || !ready}
          placeholder="例如：更复杂的模型会不会把噪声也学进去？"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="gate-footer">
        <span>
          <LockKeyhole size={15} />
          提交前暂不展示本轮计算结果，预测提交后锁定。
        </span>
        <button
          className="button primary"
          disabled={choice === null || confidence === null || !ready || working}
          onClick={() => void onSubmit(choice!, confidence!, reason)}
        >
          {working
            ? "正在记录预测…"
            : !ready
              ? "正在恢复学习记录…"
              : "锁定预测，开始实验"}
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

export function PredictionReview({
  attempt,
  onReset,
}: {
  attempt: LearningAttempt;
  onReset: () => void;
}) {
  const review = attempt.prediction_review;
  return (
    <section className="prediction-review" aria-label="本轮预测记录">
      <div>
        <span>你的预测</span>
        <strong>{attempt.prediction.label}</strong>
        <small>
          信心：
          {
            ["先试着猜", "有一些依据", "比较确定"][
              attempt.prediction.confidence - 1
            ]
          }
        </small>
        {attempt.prediction.reason && <p>{attempt.prediction.reason}</p>}
      </div>
      <div aria-live="polite">
        {review ? (
          <>
            <strong>
              {review.matched
                ? "本轮结果支持你的预测"
                : "本轮结果与你的预测不同"}
            </strong>
            <p>
              实际验证误差最低：{review.best_labels.join("、")}。{review.note}
            </p>
          </>
        ) : (
          <>
            <strong>预测已锁定，等待三次实际对照</strong>
            <p>完成三个推荐条件后，再判断它是否得到支持。</p>
          </>
        )}
      </div>
      <button className="text-button" onClick={onReset}>
        <RefreshCw size={14} />
        开启新一轮预测
      </button>
    </section>
  );
}

export function TransferValidation({
  attempt,
  working,
  onSubmit,
  onRetry,
  onRealData,
}: {
  attempt: LearningAttempt;
  working: boolean;
  onSubmit: (choice: number, reason: number) => Promise<void>;
  onRetry: () => Promise<void>;
  onRealData: () => void;
}) {
  const task = attempt.task;
  const feedback = attempt.transfer_attempts.find(
    (item) => item.task.id === task?.id,
  );
  const [choice, setChoice] = useState<number | null>(feedback?.choice ?? null);
  const [reason, setReason] = useState<number | null>(feedback?.reason ?? null);
  return (
    <section className="panel transfer-panel" aria-labelledby="transfer-title">
      <div className="panel-heading compact">
        <h2 id="transfer-title">
          <Target size={18} />
          换一批数据，验证理解
        </h2>
        <span className="coach-mode">
          {attempt.stage === "complete" ? "本轮已完成" : "迁移验证"}
        </span>
      </div>
      {!task ? (
        <div className="transfer-locked">
          <LockKeyhole size={24} />
          <h3>先完成本轮三步对照</h3>
          <p>
            已记录 {attempt.observations.length}/3
            个条件。完成后会换一个随机种子，用新数据检验你的模型选择与判断依据。
          </p>
        </div>
      ) : (
        <div className="transfer-body">
          <p className="question-text">{task.question}</p>
          <p className="muted small-copy">
            新随机种子 {task.seed} · 数值保留6位有效数字 ·
            这些是验证数据，独立测试未参与。
          </p>
          <div className="transfer-table-wrap">
            <table className="transfer-table">
              <thead>
                <tr>
                  <th>实验组</th>
                  <th>训练 MSE</th>
                  <th>验证 MSE</th>
                </tr>
              </thead>
              <tbody>
                {task.rows.map((row) => (
                  <tr key={row.name}>
                    <th>
                      {row.name}：{row.label}
                    </th>
                    <td>{row.metrics.train_mse.toPrecision(6)}</td>
                    <td>{row.metrics.validation_mse.toPrecision(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <fieldset
            className="transfer-options"
            disabled={!!feedback || working}
          >
            <legend>你的选择</legend>
            {task.options.map((option, i) => (
              <label key={option}>
                <input
                  type="radio"
                  name="transfer-choice"
                  checked={choice === i}
                  onChange={() => setChoice(i)}
                />
                {option}
              </label>
            ))}
          </fieldset>
          <fieldset
            className="transfer-options"
            disabled={!!feedback || working}
          >
            <legend>更合理的判断依据</legend>
            {task.reasons.map((option, i) => (
              <label key={option}>
                <input
                  type="radio"
                  name="transfer-reason"
                  checked={reason === i}
                  onChange={() => setReason(i)}
                />
                {option}
              </label>
            ))}
          </fieldset>
          {feedback ? (
            <div
              className={`answer-feedback ${feedback.passed ? "correct" : "retry"}`}
              role="status"
            >
              <strong>
                {feedback.passed
                  ? "迁移验证通过，本轮闭环已保存"
                  : "这次还未通过，先核对判断依据"}
              </strong>
              <p>{feedback.explanation}</p>
              <p>
                已提交 {attempt.transfer_attempts.length} 次；首次作答
                {attempt.transfer_attempts[0]?.passed ? "通过" : "未通过"}。
              </p>
              {feedback.passed ? (
                <button className="button secondary" onClick={onRealData}>
                  去真实数据中继续检验
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  className="button secondary"
                  disabled={working}
                  onClick={() => void onRetry()}
                >
                  换一组新数据再验证
                  <RefreshCw size={15} />
                </button>
              )}
            </div>
          ) : (
            <button
              className="button primary full-width"
              disabled={choice === null || reason === null || working}
              onClick={() => void onSubmit(choice!, reason!)}
            >
              {working ? "正在核验作答…" : "提交迁移判断"}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
