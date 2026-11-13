"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Copy,
  MoveVertical,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  ConceptFitPlot,
  LossLandscape,
  ErrorContributions,
  ShiftRibbon,
  CoefficientBars,
  NormPath,
} from "./ConceptFigures";
import { useConceptExperiment } from "./useConceptExperiment";
import {
  alphaText,
  bounded,
  conceptAlphas,
  conceptDefaults,
  conceptNumber,
  editConceptPoint,
  readConceptInput,
  type ConceptInput,
  type ConceptPanel,
} from "@/lib/concepts";
import type { SceneId } from "@/lib/experiment";

const panels = [
  {
    id: "error" as const,
    title: "误差的几何",
    question: "一条线，怎样才算拟合得好？",
    instruction:
      "上下拖动训练点，或拖动右侧地形标记。看看残差、平方项和拟合线如何一起变化。",
  },
  {
    id: "sensitivity" as const,
    title: "过拟合的牵引",
    question: "一个样本，能牵动整条曲线吗？",
    instruction:
      "拖远同一个训练点，对比固定3阶的参考A与可调阶数的模型B；虚线保留原始样本上的拟合。",
  },
  {
    id: "regularization" as const,
    title: "约束的形状",
    question: "正则化究竟在约束什么？",
    instruction:
      "滑动α或点击路径节点，让模型曲线、标准化系数和惩罚项一起变化。也可以拖点观察约束后的响应。",
  },
];

function Range({
  label,
  shortLabel,
  value,
  display,
  min,
  max,
  step,
  onChange,
  onDrag,
}: {
  label: string;
  shortLabel?: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  onDrag: (b: boolean) => void;
}) {
  return (
    <label className="concept-range">
      <span>
        {shortLabel || label}
        <output>{display}</output>
      </span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => onDrag(true)}
        onPointerUp={() => onDrag(false)}
        onPointerCancel={() => onDrag(false)}
        onBlur={() => onDrag(false)}
      />
    </label>
  );
}
function Metric({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption?: string;
}) {
  return (
    <div className="concept-metric">
      <span>{label}</span>
      <strong>{conceptNumber(value)}</strong>
      {caption && <small>{caption}</small>}
    </div>
  );
}

export default function ConceptWorkshop({
  onLearn,
}: {
  onLearn: (scene: SceneId) => void;
}) {
  const [input, setInput] = useState<ConceptInput>(conceptDefaults);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const { result, error, pending, retry } = useConceptExperiment(input, ready);
  useEffect(() => {
    const saved = readConceptInput(
      localStorage.getItem("fitlab-concept-session-v1"),
    );
    if (saved) setInput(saved);
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      localStorage.setItem("fitlab-concept-session-v1", JSON.stringify(input));
    setCopyStatus("");
  }, [ready, input]);
  const panel = panels.find((row) => row.id === input.panel)!;
  const compatible =
    !!result &&
    result.parameters.seed === input.seed &&
    result.parameters.samples === input.samples &&
    result.parameters.noise === input.noise;
  const selectedPoint = result?.train[selected];
  const selectedY = compatible
    ? (input.edits.find((row) => row.index === selected)?.y ??
      selectedPoint?.y ??
      0)
    : 0;
  const waiting = pending || dragging;
  function point(index: number, y: number) {
    if (compatible) setInput((value) => editConceptPoint(value, index, y));
  }
  function number(
    key: "samples" | "noise" | "degree" | "alpha" | "slope" | "intercept",
    value: number,
  ) {
    if (key === "samples") {
      setSelected((index) => Math.min(index, value - 1));
      setInput((old) => ({
        ...old,
        samples: value,
        edits: old.edits.filter((edit) => edit.index < value),
      }));
    } else setInput((old) => ({ ...old, [key]: value }));
  }
  function selectPanel(value: ConceptPanel) {
    setDragging(false);
    setInput((old) => ({ ...old, panel: value }));
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            parameters: input,
            fingerprint: result?.data_fingerprint,
            protocol: result?.protocol,
          },
          null,
          2,
        ),
      );
      setCopyStatus("参数已复制");
    } catch {
      setCopyStatus("可在下方“实算依据”中复制参数。");
    }
  }
  const fitProps = result
    ? {
        result,
        input,
        selected,
        onSelect: (index: number) =>
          setSelected(Math.min(index, input.samples - 1)),
        onEdit: point,
        onDrag: setDragging,
      }
    : null;
  return (
    <section className="concept-workshop" aria-label="概念工坊">
      <header className="concept-heading">
        <div>
          <p className="concept-kicker">可操纵的机器学习概念</p>
          <div className="concept-title-with-guide">
            <Image
              src="/illustrations/fitlab-guide-v1.png"
              alt=""
              width={61}
              height={56}
              sizes="(max-width:760px) 42px, 61px"
            />
            <h1>把概念，拖到眼前。</h1>
          </div>
          <p>点的位置、模型的形状、误差和约束，在同一张画布里彼此回应。</p>
        </div>
        <div className="concept-heading-actions">
          <button
            className="button secondary"
            onClick={() => {
              setInput({ ...conceptDefaults });
              setSelected(0);
              setDragging(false);
            }}
          >
            <RotateCcw size={15} />
            重置工坊
          </button>
          <button
            className="text-button"
            disabled={!result || pending}
            onClick={() => void copy()}
          >
            <Copy size={15} />
            {copyStatus === "参数已复制" ? "参数已复制" : "复制实验参数"}
          </button>
        </div>
      </header>
      <span className="sr-only" role="status">
        {copyStatus}
      </span>
      <nav className="concept-tabs" aria-label="选择概念面板">
        {panels.map((row, i) => (
          <button
            key={row.id}
            aria-pressed={input.panel === row.id}
            onClick={() => selectPanel(row.id)}
          >
            <span>{i + 1}</span>
            {row.title}
          </button>
        ))}
      </nav>
      <div className="concept-scene-heading">
        <div>
          <h2>{panel.question}</h2>
          <p>
            <MoveVertical size={16} />
            {panel.instruction}
          </p>
        </div>
        <span
          className={`concept-state ${waiting ? "pending" : ""}`}
          role="status"
        >
          {!result
            ? "正在计算…"
            : waiting
              ? "更新中 · 指标为最近实算"
              : "已匹配当前输入"}
        </span>
      </div>
      <div className="concept-data-bar">
        <span>探索数据 seed {input.seed}</span>
        <span>训练 {input.samples} 点</span>
        <span>验证 80 点</span>
        <span>噪声 σ={input.noise.toFixed(2)}</span>
        <details className="concept-data-settings">
          <summary>
            <SlidersHorizontal size={15} />
            数据条件
          </summary>
          <div>
            <Range
              label="工坊训练样本量"
              value={input.samples}
              display={`${input.samples} 点`}
              min={12}
              max={60}
              step={1}
              onChange={(n) => number("samples", n)}
              onDrag={setDragging}
            />
            <Range
              label="工坊噪声水平"
              value={input.noise}
              display={input.noise.toFixed(2)}
              min={0}
              max={0.6}
              step={0.01}
              onChange={(n) => number("noise", n)}
              onDrag={setDragging}
            />
            <label className="concept-seed">
              数据种子
              <select
                aria-label="工坊数据种子"
                value={input.seed}
                onChange={(e) => {
                  setSelected(0);
                  setInput((old) => ({
                    ...old,
                    seed: Number(e.target.value) as ConceptInput["seed"],
                    edits: [],
                  }));
                }}
              >
                {[2026, 314, 2718].map((seed) => (
                  <option key={seed}>{seed}</option>
                ))}
              </select>
            </label>
          </div>
        </details>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={retry}>重新计算</button>
        </div>
      )}
      {input.panel === "sensitivity" && (
        <div className="concept-primary-control">
          <Range
            label="观察模型B阶数"
            shortLabel="观察B阶数"
            value={input.degree}
            display={`${input.degree} 阶`}
            min={1}
            max={15}
            step={1}
            onChange={(n) => number("degree", n)}
            onDrag={setDragging}
          />
          <Range
            label="两组共同正则化α"
            shortLabel="共同约束α"
            value={conceptAlphas.indexOf(input.alpha)}
            display={alphaText(input.alpha)}
            min={0}
            max={7}
            step={1}
            onChange={(n) => number("alpha", conceptAlphas[n])}
            onDrag={setDragging}
          />
        </div>
      )}
      {input.panel === "regularization" && (
        <div className="concept-primary-control">
          <Range
            label="工坊正则化强度α"
            shortLabel="正则化强度"
            value={conceptAlphas.indexOf(input.alpha)}
            display={`α = ${alphaText(input.alpha)}`}
            min={0}
            max={7}
            step={1}
            onChange={(n) => number("alpha", conceptAlphas[n])}
            onDrag={setDragging}
          />
          <Range
            label="工坊多项式阶数"
            shortLabel="模型阶数"
            value={input.degree}
            display={`${input.degree} 阶`}
            min={1}
            max={15}
            step={1}
            onChange={(n) => number("degree", n)}
            onDrag={setDragging}
          />
        </div>
      )}
      {!result || !fitProps ? (
        <div className="concept-loading">正在建立可操纵的几何视图…</div>
      ) : (
        <>
          {result.linear && (
            <>
              <div className="concept-stage">
                <section className="concept-pane">
                  <div className="concept-pane-title">
                    <h3>数据空间</h3>
                    <span>
                      ŷ = {input.slope.toFixed(3)} x{" "}
                      {input.intercept >= 0 ? "+" : "−"}{" "}
                      {Math.abs(input.intercept).toFixed(3)}
                    </span>
                  </div>
                  <ConceptFitPlot
                    {...fitProps}
                    curve={result.linear.curve}
                    residuals
                    label="线性拟合与残差平方，可上下拖动训练点"
                  />
                  <ErrorContributions
                    result={result}
                    selected={selected}
                    onSelect={(index) =>
                      setSelected(Math.min(index, input.samples - 1))
                    }
                  />
                </section>
                <section className="concept-pane landscape-pane">
                  <div className="concept-pane-title">
                    <h3>参数空间：训练误差地形</h3>
                    <button
                      className="text-button"
                      disabled={!result.linear.optimum.in_view}
                      onClick={() =>
                        setInput((old) => ({
                          ...old,
                          slope: result.linear!.optimum.slope,
                          intercept: result.linear!.optimum.intercept,
                        }))
                      }
                    >
                      移到最小二乘解
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  <LossLandscape
                    result={result}
                    input={input}
                    onWeights={(a, b) =>
                      setInput((old) => ({ ...old, slope: a, intercept: b }))
                    }
                    onDrag={setDragging}
                  />
                  <div className="concept-weight-controls">
                    <Range
                      label="直线斜率a"
                      value={input.slope}
                      display={input.slope.toFixed(3)}
                      min={-4}
                      max={4}
                      step={0.001}
                      onChange={(n) => number("slope", n)}
                      onDrag={setDragging}
                    />
                    <Range
                      label="直线截距b"
                      value={input.intercept}
                      display={input.intercept.toFixed(3)}
                      min={-2}
                      max={2}
                      step={0.001}
                      onChange={(n) => number("intercept", n)}
                      onDrag={setDragging}
                    />
                  </div>
                </section>
              </div>
              <div className="concept-evidence-row">
                <Metric label="训练 MSE" value={result.linear.train_mse} />
                <Metric label="验证 MSE" value={result.linear.validation_mse} />
                <Metric
                  label={`训练点${selected + 1}的残差 e`}
                  value={result.linear.residuals[selected]?.error ?? 0}
                />
                <Metric
                  label="选中平方项 e²"
                  value={result.linear.residuals[selected]?.squared ?? 0}
                />
              </div>
              <div className="concept-explanation">
                <strong>从距离，到损失函数</strong>
                <p>
                  残差是 y −
                  ŷ；图中的方块面积对应选中残差的平方。把所有平方项相加，再除以训练点数：
                  <b>
                    {conceptNumber(result.linear.sse)} ÷ {result.train.length} ={" "}
                    {conceptNumber(result.linear.train_mse)}
                  </b>
                  。移到最小二乘解只优化这条直线，弯曲规律可能仍然拟合不好。
                </p>
              </div>
            </>
          )}
          {result.pairs && (
            <>
              <div className="concept-stage sensitivity-stage">
                {result.pairs.map((pair, i) => (
                  <section className="concept-pane" key={i}>
                    <div className="concept-pane-title">
                      <h3>
                        {i === 0
                          ? "参考A：固定3阶"
                          : `观察B：${pair.edited.degree}阶`}
                      </h3>
                      <span>同一扰动、同一验证集</span>
                    </div>
                    <ConceptFitPlot
                      {...fitProps}
                      curve={pair.edited.curve}
                      baseline={pair.baseline.curve}
                      label={`${i === 0 ? "参考A" : "观察B"}扰动前后拟合对照，可拖动训练点`}
                    />
                    <ShiftRibbon
                      difference={pair.difference}
                      maximum={result.max_shift!}
                    />
                    <p className="concept-figure-note">
                      颜色越深，当前x处的预测变化越大；两组共用色标。
                    </p>
                    <div className="concept-mini-metrics">
                      <Metric label="整条曲线变化 RMS" value={pair.shift_rms} />
                      <Metric
                        label="验证MSE变化"
                        value={pair.validation_delta}
                      />
                      <Metric
                        label="当前验证MSE"
                        value={pair.edited.validation_mse}
                      />
                    </div>
                  </section>
                ))}
              </div>
              <div className="concept-explanation">
                <strong>
                  {!input.edits.length
                    ? "先拖动一个训练点，再比较模型的反应"
                    : result.pairs[1].shift_rms > result.pairs[0].shift_rms
                      ? "本次观察B的整体变化更大"
                      : "本次观察B没有显示更大的整体变化"}
                </strong>
                <p>
                  RMS衡量161个固定x位置上预测变化的均方根，不是统计置信区间。相同的训练标签扰动，会因模型容量和约束不同而产生不同影响；一次实验不证明阶数越高就一定更敏感。
                </p>
              </div>
            </>
          )}
          {result.regularization && (
            <>
              <div className="concept-stage">
                <section className="concept-pane">
                  <div className="concept-pane-title">
                    <h3>弱约束与当前约束</h3>
                    <span>
                      虚线 α=1e-8；实线 α=
                      {alphaText(result.regularization.current.alpha)}
                    </span>
                  </div>
                  <ConceptFitPlot
                    {...fitProps}
                    curve={result.regularization.current.curve}
                    baseline={result.regularization.weak.curve}
                    label="弱约束与当前正则化拟合，可拖动训练点"
                  />
                  <div className="concept-objective">
                    <strong>当前优化目标 = SSE + α ‖w‖²</strong>
                    <div className="objective-bars">
                      <span
                        style={{
                          flex:
                            (100 * result.regularization.current.sse) /
                            Math.max(
                              result.regularization.current.objective,
                              1e-12,
                            ),
                        }}
                      />
                      <span
                        style={{
                          flex:
                            (100 * result.regularization.current.penalty) /
                            Math.max(
                              result.regularization.current.objective,
                              1e-12,
                            ),
                        }}
                      />
                    </div>
                    <p>
                      数据误差{" "}
                      {conceptNumber(result.regularization.current.sse)} +
                      惩罚项{" "}
                      {conceptNumber(result.regularization.current.penalty)} ={" "}
                      {conceptNumber(result.regularization.current.objective)}
                    </p>
                  </div>
                </section>
                <section className="concept-pane">
                  <div className="concept-pane-title">
                    <h3>系数真的在怎样变化？</h3>
                    <span>相同标准化特征基</span>
                  </div>
                  <CoefficientBars
                    weak={result.regularization.weak}
                    current={result.regularization.current}
                  />
                  <NormPath
                    path={result.regularization.path}
                    alpha={input.alpha}
                    onAlpha={(n) => number("alpha", n)}
                  />
                </section>
              </div>
              <div className="concept-evidence-row">
                <Metric
                  label="弱约束系数范数"
                  value={result.regularization.weak.weight_norm}
                />
                <Metric
                  label="当前系数范数"
                  value={result.regularization.current.weight_norm}
                />
                <Metric
                  label="训练 MSE"
                  value={result.regularization.current.train_mse}
                />
                <Metric
                  label="验证 MSE"
                  value={result.regularization.current.validation_mse}
                />
              </div>
              <div className="concept-explanation">
                <strong>
                  {result.regularization.current.validation_mse >
                  result.regularization.weak.validation_mse
                    ? "这次约束更强，验证误差却更高"
                    : "观察系数收缩，再核对验证误差"}
                </strong>
                <p>
                  {result.regularization.basis}
                  整体范数受到约束，单个系数可能非单调变化。不同α的目标定义不同，选择模型仍看验证表现。当前目标中的数据项是SSE，不把MSE与α‖w‖²直接相加。
                </p>
              </div>
            </>
          )}
          <div className="concept-point-editor">
            <label>
              选择训练点
              <select
                aria-label="选择工坊训练点"
                value={selected}
                disabled={!compatible}
                onChange={(e) => setSelected(Number(e.target.value))}
              >
                {result.train.map((p, i) => (
                  <option key={i} value={i}>
                    点{i + 1} · x={p.x.toFixed(3)}
                  </option>
                ))}
              </select>
            </label>
            <Range
              label="选中训练点的y"
              value={bounded(selectedY, -3, 3)}
              display={selectedY.toFixed(3)}
              min={-3}
              max={3}
              step={0.01}
              onChange={(n) => point(selected, n)}
              onDrag={setDragging}
            />
            <button
              className="button secondary"
              disabled={!compatible}
              onClick={() => point(selected, selectedY + 0.5)}
            >
              向上扰动0.5
            </button>
            <button
              className="text-button"
              onClick={() =>
                setInput((old) => ({
                  ...old,
                  edits: old.edits.filter((edit) => edit.index !== selected),
                }))
              }
            >
              还原本点
            </button>
            <button
              className="text-button"
              onClick={() => setInput((old) => ({ ...old, edits: [] }))}
            >
              还原所有样本
            </button>
          </div>
          <footer className="concept-footer">
            <p>
              自由探索与当前学习轮次分开。验证样本不参与拖拽，独立测试未参与。
              <span>
                数据 {result.data_fingerprint} · 验证{" "}
                {result.validation_fingerprint.slice(0, 8)}
              </span>
            </p>
            <button
              className="button primary"
              onClick={() =>
                onLearn(
                  input.panel === "regularization"
                    ? "regularization"
                    : "complexity",
                )
              }
            >
              带着观察去验证
              <ArrowRight size={15} />
            </button>
          </footer>
          <details className="concept-proof">
            <summary>实算依据与参数</summary>
            <p>{result.protocol}</p>
            <pre>{JSON.stringify(input, null, 2)}</pre>
            {copyStatus && <p role="status">{copyStatus}</p>}
          </details>
        </>
      )}
    </section>
  );
}
