"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  FlaskConical,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/experiment";
import {
  actionValue,
  parameterKey,
  type ActionParameters,
  type ActionPlan,
  type VerifiedAction,
} from "@/lib/actions";

export function VerificationResult({ value }: { value: VerifiedAction }) {
  const labels = {
    supported: "这次结果支持预期",
    not_supported: "这次结果不支持预期",
    observed: "本次仅记录观察结果",
  };
  return (
    <div className={`verification-result ${value.verdict}`} role="status">
      <strong>
        <ShieldCheck size={17} />
        {labels[value.verdict]}
      </strong>
      <p className="verification-change">
        <b>
          {value.change.label}：
          {actionValue(value.change.control, value.change.from_value)} →{" "}
          {actionValue(value.change.control, value.change.to_value)}
        </b>
      </p>
      <p>{value.hypothesis}</p>
      <p>
        原假设方向：
        {value.expected === "lower"
          ? "验证误差降低"
          : value.expected === "higher"
            ? "验证误差升高"
            : "只观察，不预设方向"}
        。
      </p>
      <p>
        {value.before.dataset?.title || "合成余弦数据"} ·{" "}
        {value.metric === "validation_mse"
          ? "验证 MSE"
          : `验证 RMSE（${value.before.dataset?.unit || "原目标单位"}）`}
      </p>
      <div className="verification-values">
        <div>
          <span>执行前</span>
          <b>{value.before.metrics[value.metric].toPrecision(6)}</b>
        </div>
        <ArrowRight size={17} />
        <div>
          <span>执行后</span>
          <b>{value.after.metrics[value.metric].toPrecision(6)}</b>
        </div>
      </div>
      <p>
        验证{value.metric === "validation_mse" ? " MSE" : " RMSE"}
        {value.observed === "lower"
          ? "降低"
          : value.observed === "higher"
            ? "升高"
            : "基本不变"}
        ；变化量 {value.delta >= 0 ? "+" : ""}
        {value.delta.toPrecision(5)}。
      </p>
      <p>{value.note}</p>
      <details>
        <summary>查看可复算证据</summary>
        <dl className="verification-proof">
          <div>
            <dt>执行时间</dt>
            <dd>{new Date(value.executed_at).toLocaleString("zh-CN")}</dd>
          </div>
          <div>
            <dt>执行前指纹</dt>
            <dd>{value.before.data_fingerprint || value.before.fingerprint}</dd>
          </div>
          <div>
            <dt>执行后指纹</dt>
            <dd>{value.after.data_fingerprint || value.after.fingerprint}</dd>
          </div>
        </dl>
        <pre>
          {JSON.stringify(
            { before: value.before.parameters, after: value.after.parameters },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}

export default function ActionExperiment({
  kind,
  parameters,
  enabled,
  previouslyViewed = false,
  onApply,
  onVerified,
  learningAttemptId,
}: {
  kind: "synthetic" | "bench";
  parameters: ActionParameters;
  enabled: boolean;
  previouslyViewed?: boolean;
  onApply: (parameters: ActionParameters) => void;
  onVerified?: (id: string) => void;
  learningAttemptId?: string;
}) {
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [verification, setVerification] = useState<VerifiedAction | null>(null);
  const [generating, setGenerating] = useState(false),
    [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<AbortController | null>(null);
  const key = parameterKey(parameters);
  const currentKey = useRef(key);
  currentKey.current = key;
  const applicable = !!plan && parameterKey(plan.baseline_parameters) === key;
  useEffect(() => {
    setGenerating(false);
    setExecuting(false);
    setError("");
    return () => operation.current?.abort();
  }, [key]);

  async function generate() {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setGenerating(true);
    setError("");
    setPlan(null);
    setVerification(null);
    try {
      const value = await api<ActionPlan>(
        "/actions/plan",
        {
          kind,
          parameters,
          test_previously_viewed: previouslyViewed,
          learning_attempt_id: learningAttemptId,
        },
        controller.signal,
      );
      if (!controller.signal.aborted && currentKey.current === key)
        setPlan(value);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setGenerating(false);
    }
  }
  async function execute() {
    if (!plan || !applicable) return;
    const controller = new AbortController();
    operation.current = controller;
    setExecuting(true);
    setError("");
    try {
      const value = await api<VerifiedAction>(
        `/actions/${plan.id}/execute`,
        { parameters },
        controller.signal,
      );
      if (!controller.signal.aborted && currentKey.current === key) {
        setVerification(value);
        onVerified?.(value.id);
        onApply(value.after.parameters);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setExecuting(false);
    }
  }
  return (
    <div className="action-experiment" aria-label="可执行实验建议">
      <div className="action-heading">
        <h3>
          <FlaskConical size={18} />
          让建议接受实验检验
        </h3>
        {plan && (
          <span className="coach-mode">
            {plan.mode === "online" ? "AI建议" : "规则建议"}
          </span>
        )}
      </div>
      <p>先提出假设，再只改变一个变量，用真实验证误差核对预期。</p>
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
      {plan && !verification && (
        <div className="action-plan">
          <strong>
            {plan.change.label}：
            {actionValue(plan.change.control, plan.change.from_value)}{" "}
            <ArrowRight size={15} />{" "}
            {actionValue(plan.change.control, plan.change.to_value)}
          </strong>
          <p>{plan.hypothesis}</p>
          <p className="action-expectation">
            待检验预期：
            {plan.expected === "lower"
              ? "验证误差降低"
              : plan.expected === "higher"
                ? "验证误差升高"
                : "先观察，不预设改善方向"}
          </p>
          <p className="small-copy muted">
            固定其他参数和随机种子，不读取独立测试指标。
          </p>
          {plan.notice && <p className="coach-notice">{plan.notice}</p>}
          {applicable ? (
            <button
              className="button primary full-width"
              disabled={!enabled || executing || generating}
              onClick={() => void execute()}
            >
              {executing ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <FlaskConical size={16} />
              )}
              {executing ? "正在重算并核验…" : "执行并核验"}
            </button>
          ) : (
            <p className="action-error">条件已改变，请重新生成建议。</p>
          )}
        </div>
      )}
      {verification && (
        <>
          <VerificationResult value={verification} />
          <div className="verification-controls" aria-label="核验条件切换">
            <p aria-live="polite">
              工作台当前：
              {key === parameterKey(verification.before.parameters)
                ? "执行前条件"
                : key === parameterKey(verification.after.parameters)
                  ? "执行后条件"
                  : "其他条件"}
            </p>
            <button
              className="button secondary"
              disabled={
                !enabled || key === parameterKey(verification.before.parameters)
              }
              onClick={() => onApply(verification.before.parameters)}
            >
              恢复执行前条件
            </button>
            <button
              className="text-button"
              disabled={
                !enabled || key === parameterKey(verification.after.parameters)
              }
              onClick={() => onApply(verification.after.parameters)}
            >
              回看执行后条件
            </button>
          </div>
          <p className="small-copy muted">
            核验记录已保存在学习档案的“AI核验”中，刷新后仍可查看。
          </p>
        </>
      )}
      <button
        className="button secondary full-width"
        disabled={!enabled || generating || executing}
        onClick={() => void generate()}
      >
        {generating ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Sparkles size={16} />
        )}
        {generating
          ? "正在生成单变量假设…"
          : plan
            ? "基于当前条件生成新建议"
            : "生成可执行实验建议"}
      </button>
    </div>
  );
}
