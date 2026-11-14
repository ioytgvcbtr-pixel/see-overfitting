"use client";
import { useState } from "react";
import {
  Flag,
  Copy,
  RotateCcw,
  BookmarkCheck,
  Hand,
  Lightbulb,
  Check,
} from "lucide-react";
import {
  conceptNumber,
  type ConceptInput,
  type ConceptResult,
} from "@/lib/concepts";
import type { ConceptDraft } from "@/lib/island-progress";
import { useConceptChallenge } from "./useConceptChallenge";
import HelpHint from "./HelpHint";
import LearningCompanion from "./LearningCompanion";
import LayeredHint from "./LayeredHint";

const titles = {
  error: "驶入最小误差港",
  sensitivity: "一枚路钉，两种回应",
  regularization: "收起枝条，再看远处",
};
export default function GuidedConceptQuest({
  input,
  result,
  pending,
  onInput,
  resume,
  onResumeConsumed,
  onResumeRequest,
  onLocate,
  selected,
}: {
  input: ConceptInput;
  result: ConceptResult;
  pending: boolean;
  onInput: (p: ConceptInput) => void;
  resume: ConceptDraft | null;
  onResumeConsumed: () => void;
  onResumeRequest: (d: ConceptDraft) => void;
  onLocate: (level: number) => void;
  selected: number;
}) {
  const q = useConceptChallenge(
      input,
      result,
      pending,
      onInput,
      resume,
      onResumeConsumed,
      selected,
    ),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState("");
  const o = q.observation;
  const first =
    input.panel === "sensitivity"
      ? "先找到A和B的变化RMS。它衡量整条路的变化，不是验证误差。"
      : input.panel === "regularization"
        ? "先看系数范数，再看验证MSE。枝条变短并不意味着验证误差必然降低。"
        : "先找到验证MSE，用它比较新数据上的表现；训练误差不能替它作答。";
  const second = o
    ? input.panel === "sensitivity"
      ? `同一扰动下，A的变化RMS为${conceptNumber(o.evidence.a_shift_rms)}，B为${conceptNumber(o.evidence.b_shift_rms)}。比较这两个数的大小，再选择。`
      : `相同验证数据：起点MSE ${conceptNumber(o.evidence.before_validation_mse)}，现在 ${conceptNumber(o.evidence.validation_mse)}。比较前后大小，判断变化方向。`
    : "先完成这次实算。";
  const title = q.error
    ? "需要重新复算"
    : q.restoring
      ? "正在续接你的挑战"
      : q.loading
        ? "正在复算起点"
        : q.active && !q.matched
          ? "正在核对操作"
          : q.correct
            ? "发现已核验"
            : q.checked
              ? "再找一条线索"
              : q.active
                ? o?.ready
                  ? "可以留下判断了"
                  : "先动手，再判断"
                : q.paused
                  ? "上次的挑战还在"
                  : "一起做次发现";
  const message = q.error
    ? "请重试起点计算后继续。"
    : q.restoring
      ? "正在用保存的参数重新计算。"
      : q.loading
        ? "完成起点计算后就能继续。"
        : q.active && !q.matched
          ? "实算后继续判断。"
          : q.correct
            ? "这次发现有实际结果支持。"
            : q.checked
              ? "看看图上的证据，再试一次。"
              : q.active
                ? o?.ready
                  ? "选择这次实际发生的变化。"
                  : (o?.reason ?? "等待当前实算。")
                : q.paused
                  ? "继续后会重新核对实际结果。"
                  : "从一次操作开始建立直觉。";
  async function copy() {
    if (!q.correct || !o || !q.baseline) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            kind: "island-discovery",
            created_at: new Date().toISOString(),
            parameters: input,
            baseline_parameters: q.baseline.parameters,
            data_fingerprint: result.data_fingerprint,
            validation_fingerprint: result.validation_fingerprint,
            choice: q.checked!.answer,
            evidence: o.evidence,
            formal_grade: false,
          },
          null,
          2,
        ),
      );
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("复制未成功，请检查浏览器剪贴板权限。");
    }
  }
  return (
    <section className="island-quest guided-quest" aria-label="岛屿观察任务">
      <div className="island-quest-heading">
        <span className="quest-emblem">
          <Flag size={24} />
        </span>
        <h3>{titles[input.panel]}</h3>
        <HelpHint title="关于观察任务">
          <p>
            任务在本浏览器保存参数、作答和提示进度。返回或刷新后复算，再恢复核验结果；不计正式成绩。可暂存并返回原实验，之后继续。
          </p>
        </HelpHint>
      </div>
      <LearningCompanion
        mood={
          q.correct
            ? "celebrate"
            : q.checked
              ? "thinking"
              : q.restoring || (q.paused && !q.active)
                ? "resume"
                : "welcome"
        }
        title={title}
        message={message}
        event={q.motionEvent}
      />
      {(q.error || q.saveError || copyError) && (
        <p role="alert">
          {q.error || q.saveError || copyError}
          {q.error && (
            <button className="text-button" onClick={q.retry}>
              重新复算
            </button>
          )}
        </p>
      )}
      {!q.active ? (
        <div className="challenge-actions">
          {q.paused && (
            <button
              className="button primary"
              onClick={() => onResumeRequest(q.paused!)}
            >
              <BookmarkCheck size={20} />
              继续挑战
            </button>
          )}
          <button
            className={`button ${q.paused ? "secondary" : "primary"}`}
            disabled={!q.matched}
            onClick={q.start}
          >
            {q.paused ? "新建任务" : "布置观察任务"}
          </button>
        </div>
      ) : (
        !q.loading &&
        !q.restoring &&
        o && (
          <>
            <ol className="quest-milestones" aria-label="挑战阶段">
              {[
                { name: "动手", icon: Hand },
                { name: "判断", icon: Lightbulb },
                { name: "核验", icon: Check },
              ].map((s, i) => (
                <li
                  key={s.name}
                  aria-current={
                    (q.checked ? 2 : o.ready ? 1 : 0) === i ? "step" : undefined
                  }
                  data-done={q.correct || (q.checked ? 2 : o.ready ? 1 : 0) > i}
                >
                  <span>
                    <s.icon size={20} />
                  </span>
                  {s.name}
                </li>
              ))}
            </ol>
            {o.progress !== undefined && (
              <label className="quest-progress">
                可减少误差已消除<output>{Math.round(o.progress * 100)}%</output>
                <progress max="1" value={o.progress} />
              </label>
            )}
            <fieldset disabled={!q.canCheck}>
              <legend>{o.question}</legend>
              <div className="quest-choices">
                {o.choices.map((c) => (
                  <button
                    key={c.id}
                    aria-pressed={q.answer === c.id}
                    onClick={() => {
                      q.choose(c.id);
                      setCopied(false);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              className="button primary"
              disabled={!q.answer || !q.canCheck}
              onClick={() => {
                q.verify();
                setCopied(false);
              }}
            >
              核验这次发现
            </button>
            {q.checked && (q.correct || q.hintLevel >= 2) && (
              <div
                className={`quest-verdict ${q.correct ? "success" : "retry"}`}
                role="status"
              >
                {(q.correct || q.hintLevel >= 2) && (
                  <p>
                    {input.panel === "sensitivity"
                      ? `变化RMS：A ${conceptNumber(result.pairs![0].shift_rms)} / B ${conceptNumber(result.pairs![1].shift_rms)}`
                      : `验证MSE：${conceptNumber(o.evidence.before_validation_mse)} → ${conceptNumber(o.evidence.validation_mse)}`}
                  </p>
                )}
                {q.correct && (
                  <button className="text-button" onClick={() => void copy()}>
                    <Copy size={20} />
                    {copied ? "发现回执已复制" : "复制发现回执"}
                  </button>
                )}
              </div>
            )}
            <LayeredHint
              level={q.hintLevel}
              onLevel={q.setHintLevel}
              onLocate={() => onLocate(Math.min(2, q.hintLevel + 1))}
              first={first}
              second={second}
              disabled={!q.matched || !Object.keys(o.evidence).length}
            />
            <button className="text-button" onClick={q.start}>
              <RotateCcw size={20} />
              重新布置
            </button>
          </>
        )
      )}
      {q.active && (
        <button className="text-button pause-challenge" onClick={q.pause}>
          <BookmarkCheck size={20} />
          暂存并返回原实验
        </button>
      )}
    </section>
  );
}
