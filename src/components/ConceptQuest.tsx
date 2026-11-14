"use client";
import { useEffect, useRef, useState } from "react";
import { Flag, Check, RotateCcw, Copy } from "lucide-react";
import {
  conceptDefaults,
  conceptKey,
  conceptNumber,
  type ConceptInput,
  type ConceptResult,
} from "@/lib/concepts";
import { observeQuest } from "@/lib/island-experiments";
import { api } from "@/lib/experiment";

const titles = {
  error: "驶入最小误差港",
  sensitivity: "一枚路钉，两种回应",
  regularization: "收起枝条，再看远处",
};
export default function ConceptQuest({
  input,
  result,
  pending,
  onInput,
}: {
  input: ConceptInput;
  result: ConceptResult;
  pending: boolean;
  onInput: (p: ConceptInput) => void;
}) {
  const [origin, setOrigin] = useState<ConceptInput | null>(null),
    [target, setTarget] = useState("");
  const [baseline, setBaseline] = useState<ConceptResult | null>(null),
    [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<{
      key: string;
      answer: string;
    } | null>(null),
    [copied, setCopied] = useState(false);
  const baselineRequest = useRef<AbortController | null>(null);
  const [taskError, setTaskError] = useState(""),
    [copyError, setCopyError] = useState("");
  const key = conceptKey(input),
    matched = !pending && conceptKey(result.parameters) === key;
  useEffect(() => () => baselineRequest.current?.abort(), []);
  useEffect(() => {
    setAnswer("");
    setChecked(null);
    setCopied(false);
    setCopyError("");
  }, [key]);
  const observation = baseline ? observeQuest(baseline, result) : null;
  const currentCheck = checked?.key === key && matched ? checked : null;
  const correct =
    !!currentCheck && currentCheck.answer === observation?.correct;
  function start() {
    if (!origin) setOrigin(structuredClone(input));
    const next = {
      ...conceptDefaults,
      panel: input.panel,
      slope: 1.8,
      intercept: 0.8,
      alpha: input.panel === "sensitivity" ? 1e-6 : 1e-8,
    };
    setBaseline(null);
    setAnswer("");
    setChecked(null);
    setCopied(false);
    setCopyError("");
    setTaskError("");
    setTarget(conceptKey(next));
    onInput(next);
    baselineRequest.current?.abort();
    const controller = new AbortController();
    baselineRequest.current = controller;
    api<ConceptResult>("/concepts/run", next, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setBaseline(value);
          setTarget("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setTaskError(`任务起点计算失败：${error.message}`);
          setTarget("");
        }
      });
  }
  async function copy() {
    if (!correct || !observation) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            kind: "island-discovery",
            created_at: new Date().toISOString(),
            parameters: input,
            baseline_parameters: baseline!.parameters,
            data_fingerprint: result.data_fingerprint,
            validation_fingerprint: result.validation_fingerprint,
            choice: currentCheck!.answer,
            evidence: observation.evidence,
            formal_grade: false,
          },
          null,
          2,
        ),
      );
      setCopied(true);
      setCopyError("");
    } catch {
      setCopied(false);
      setCopyError("复制未成功，请允许浏览器剪贴板权限后再试。");
    }
  }
  return (
    <section className="island-quest" aria-label="岛屿观察任务">
      <div className="island-quest-heading">
        <Flag size={17} />
        <h3>{titles[input.panel]}</h3>
        <span>探索任务</span>
      </div>
      {taskError && <p role="alert">{taskError}</p>}
      {copyError && <p role="status">{copyError}</p>}
      {!baseline && !target ? (
        <>
          <p>
            布置一组固定条件，操作物件，再用实际数值回答。可随时返回原实验。
          </p>
          <button
            className="button primary"
            disabled={!matched}
            onClick={start}
          >
            布置观察任务
          </button>
        </>
      ) : target ? (
        <p role="status">正在实算任务起点…</p>
      ) : (
        observation && (
          <>
            <p>
              {observation.ready
                ? "操作条件已满足，看看这次实际发生了什么。"
                : observation.reason}
            </p>
            {observation.progress !== undefined && (
              <label className="quest-progress">
                可减少训练误差已消除{" "}
                <output>{Math.round(observation.progress * 100)}%</output>
                <progress max="1" value={observation.progress} />
              </label>
            )}
            <fieldset disabled={!observation.ready || !matched}>
              <legend>{observation.question}</legend>
              <div className="quest-choices">
                {observation.choices.map((c) => (
                  <button
                    key={c.id}
                    aria-pressed={answer === c.id}
                    onClick={() => {
                      setAnswer(c.id);
                      setChecked(null);
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
              disabled={!answer || !observation.ready || !matched}
              onClick={() => setChecked({ key, answer })}
            >
              核验这次发现
            </button>
            {currentCheck && (
              <div
                className={`quest-verdict ${correct ? "success" : "retry"}`}
                role="status"
              >
                <strong>
                  {correct ? (
                    <>
                      <Check size={16} />
                      发现已核验
                    </>
                  ) : (
                    "再看看实际数值"
                  )}
                </strong>
                <p>
                  {input.panel === "sensitivity"
                    ? `A变化RMS ${conceptNumber(result.pairs![0].shift_rms)}，B ${conceptNumber(result.pairs![1].shift_rms)}。同一扰动的影响取决于阶数与约束。`
                    : `验证MSE：${conceptNumber(observation.evidence.before_validation_mse)} → ${conceptNumber(observation.evidence.validation_mse)}。训练更贴合或系数收缩，都不能代替验证表现。`}
                </p>
                {correct && (
                  <button className="text-button" onClick={() => void copy()}>
                    <Copy size={14} />
                    {copied ? "发现回执已复制" : "复制发现回执"}
                  </button>
                )}
              </div>
            )}
            <button className="text-button" onClick={start}>
              重新布置
            </button>
          </>
        )
      )}
      {origin && (
        <button
          className="text-button quest-return"
          onClick={() => {
            baselineRequest.current?.abort();
            onInput(origin);
            setOrigin(null);
            setBaseline(null);
            setTarget("");
            setChecked(null);
            setAnswer("");
            setTaskError("");
            setCopyError("");
          }}
        >
          <RotateCcw size={14} />
          返回原实验
        </button>
      )}
      <small>本页练习不计正式课程成绩；离开模块后任务重新开始。</small>
    </section>
  );
}
