"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, RotateCcw } from "lucide-react";
import { api } from "@/lib/experiment";
import {
  classModels,
  classDatasets,
  classDefaults,
  classComparisonKey,
  classPercent,
  classColors,
  classC,
  classGamma,
  editClassPoint,
  readClassInput,
  type ClassInput,
  type ClassModel,
  type ClassDataset,
  type ClassComparison,
} from "@/lib/classification";
import { useClassificationExperiment } from "./useClassificationExperiment";
import ClassificationFigure from "./ClassificationFigure";
import LabGuide from "./LabGuide";

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="concept-range">
      <span>
        {label}
        <output>{display}</output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function ClassificationLab() {
  const [input, setInput] = useState<ClassInput>(classDefaults),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [dragging, setDragging] = useState(false);
  const [prediction, setPrediction] = useState(""),
    [comparison, setComparison] = useState<ClassComparison | null>(null),
    [comparing, setComparing] = useState(false),
    [compareError, setCompareError] = useState(""),
    [copyStatus, setCopyStatus] = useState("");
  const comparingRequest = useRef<AbortController | null>(null),
    key = classComparisonKey(input);
  const casesRef = useRef<HTMLElement>(null);
  const { result, error, pending, retry } = useClassificationExperiment(
    input,
    ready,
  );
  useEffect(() => {
    const saved = readClassInput(
      localStorage.getItem("fitlab-classification-session-v1"),
    );
    if (saved) setInput(saved);
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      localStorage.setItem(
        "fitlab-classification-session-v1",
        JSON.stringify(input),
      );
    setCopyStatus("");
  }, [input, ready]);
  useEffect(() => {
    comparingRequest.current?.abort();
    setComparison(null);
    setPrediction("");
    setComparing(false);
    setCompareError("");
  }, [key]);
  useEffect(() => () => comparingRequest.current?.abort(), []);
  useEffect(() => {
    const nav = casesRef.current;
    const chosen = nav?.querySelector<HTMLButtonElement>(
      `button[data-case="${input.dataset}"]`,
    );
    if (ready && nav && chosen && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({
        left:
          chosen.offsetLeft -
          nav.offsetLeft -
          (nav.clientWidth - chosen.clientWidth) / 2,
        behavior: "instant",
      });
    }
  }, [input.dataset, ready]);
  const model = classModels.find((m) => m.id === input.model)!;
  const synthetic = !["iris", "seeds"].includes(input.dataset);
  const activePoint =
    result &&
    [...result.training, ...result.validation].find((p) => p.row === selected);
  const trainingPoint = result?.training.find((p) => p.row === selected);
  const compatible =
    result &&
    result.parameters.seed === input.seed &&
    result.parameters.noise === input.noise &&
    result.parameters.fraction === input.fraction;
  function edit(row: number, x: number, y: number) {
    if (compatible) setInput((p) => editClassPoint(p, row, x, y));
  }
  function condition(patch: Partial<ClassInput>) {
    setSelected(null);
    setDragging(false);
    setInput((p) => ({ ...p, ...patch, edits: [] }));
  }
  async function compare() {
    if (!prediction || pending) return;
    comparingRequest.current?.abort();
    const controller = new AbortController();
    comparingRequest.current = controller;
    setComparing(true);
    setCompareError("");
    try {
      const value = await api<ClassComparison>(
        "/classification/compare",
        input,
        controller.signal,
      );
      if (!controller.signal.aborted) setComparison(value);
    } catch (e) {
      if (!controller.signal.aborted)
        setCompareError(e instanceof Error ? e.message : "对照失败，请重试。");
    } finally {
      if (!controller.signal.aborted) setComparing(false);
    }
  }
  async function copy() {
    if (!result || pending) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            parameters: input,
            fingerprint: result.fingerprint,
            validation_fingerprint: result.validation_fingerprint,
            metrics: result.metrics,
            comparison:
              comparison?.fingerprint === result.fingerprint
                ? comparison
                : null,
            exploration_prediction: prediction || null,
          },
          null,
          2,
        ),
      );
      setCopyStatus("探索记录已复制");
    } catch {
      setCopyStatus("复制失败，可在数据与方法中查看参数。");
    }
  }
  return (
    <section className="classification-lab" aria-label="分类边界实验室">
      <header className="class-heading">
        <div>
          <p className="concept-kicker">从合成几何，到公开数据</p>
          <h1>让分类边界现形。</h1>
          <p>
            同一组数据，五种模型。看看它们在哪里分开类别，又在哪里判断失误。
          </p>
        </div>
        <Image
          className="class-garden"
          src="/illustrations/case-garden-v1.png"
          alt=""
          width={174}
          height={116}
          sizes="(max-width:760px) 96px, 174px"
        />
      </header>
      <nav ref={casesRef} className="class-cases" aria-label="选择分类案例">
        {classDatasets.map((d) => (
          <button
            key={d.id}
            data-case={d.id}
            aria-pressed={input.dataset === d.id}
            onClick={() => condition({ dataset: d.id as ClassDataset })}
          >
            <span className={`case-glyph case-${d.id}`} aria-hidden="true">
              {d.glyph}
            </span>
            <span>
              <strong>{d.name}</strong>
              <small>
                {d.type} · {d.hint}
              </small>
            </span>
          </button>
        ))}
      </nav>
      <div className="class-toolbar">
        <div
          className={`concept-state ${pending || dragging ? "pending" : ""}`}
          role="status"
        >
          {!result
            ? "正在计算边界…"
            : pending || dragging
              ? "更新中 · 指标为最近实算"
              : "已匹配当前输入"}
        </div>
        <span>探索模式 · 不计课程成绩</span>
        <div className="class-toolbar-actions">
          <button
            className="text-button"
            disabled={!result || pending}
            onClick={() => void copy()}
          >
            <Copy size={14} />
            {copyStatus === "探索记录已复制" ? copyStatus : "复制探索记录"}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setSelected(null);
              setDragging(false);
              setInput({ ...classDefaults });
            }}
          >
            <RotateCcw size={14} />
            重置
          </button>
        </div>
      </div>
      <span className="class-sr-status" role="status">
        {copyStatus}
      </span>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={retry}>重新计算</button>
        </div>
      )}
      <div className="class-workspace">
        <section className="class-map-pane">
          <div className="class-map-title">
            <div>
              <p className="concept-kicker">
                {result?.dataset.title ??
                  classDatasets.find((d) => d.id === input.dataset)!.name}{" "}
                · {model.name}
              </p>
              <h2>{result?.dataset.question ?? "正在准备这一案例…"}</h2>
            </div>
          </div>
          {result ? (
            <>
              <ClassificationFigure
                result={result}
                input={input}
                selected={selected}
                onSelect={setSelected}
                onEdit={edit}
                onDrag={setDragging}
              />
              <div className="class-legend">
                {result.dataset.classes.map((name, i) => (
                  <span key={name}>
                    <i
                      style={{
                        background: classColors[i],
                        clipPath:
                          i === 1
                            ? "polygon(50% 0,100% 100%,0 100%)"
                            : undefined,
                        borderRadius: i === 0 ? "50%" : 0,
                      }}
                    />
                    {String.fromCharCode(65 + i)} · {name}
                  </span>
                ))}
                <span>实心=训练 · 空心=验证 · ×=错分</span>
              </div>
              <p className="class-plot-note">
                底色表示模型预测的类别，不代表置信度。
                {synthetic
                  ? "可拖动合成训练点；选中后用方向键微调。"
                  : "公开样本只读；模型只用图中两个特征。"}
              </p>
              <div className="class-point-note" aria-live="polite">
                {activePoint ? (
                  <>
                    <strong>点{activePoint.row + 1}</strong>
                    <span>
                      x={activePoint.x.toFixed(2)} · y=
                      {activePoint.y.toFixed(2)}
                    </span>
                    <span>
                      真实：{result.dataset.classes[activePoint.label]}
                    </span>
                    <span>
                      预测：{result.dataset.classes[activePoint.prediction]}
                    </span>
                    <span>
                      {trainingPoint ? "训练样本" : "验证样本"} ·{" "}
                      {activePoint.correct ? "分类正确" : "本次错分"}
                    </span>
                  </>
                ) : (
                  <span>
                    点选一个样本，查看真实类别与模型判断；点击下方混淆矩阵也能定位样本。
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="concept-loading">正在计算这幅决策地图…</div>
          )}
        </section>
        <aside className="class-controls" aria-label="分类模型与条件">
          <h3>换一种判断方式</h3>
          <div className="class-models" role="group" aria-label="选择分类模型">
            {classModels.map((m) => (
              <button
                key={m.id}
                aria-pressed={input.model === m.id}
                onClick={() => setInput((p) => ({ ...p, model: m.id }))}
              >
                {m.name}
              </button>
            ))}
          </div>
          <p className="class-model-hint">{model.hint}</p>
          {(input.model === "logistic" || input.model === "svm") && (
            <Slider
              label="误分惩罚 C"
              value={classC.indexOf(input.c)}
              display={String(input.c)}
              min={0}
              max={4}
              step={1}
              onChange={(v) => setInput((p) => ({ ...p, c: classC[v] }))}
            />
          )}
          {input.model === "svm" && (
            <Slider
              label="RBF γ"
              value={classGamma.indexOf(input.gamma)}
              display={String(input.gamma)}
              min={0}
              max={5}
              step={1}
              onChange={(v) =>
                setInput((p) => ({ ...p, gamma: classGamma[v] }))
              }
            />
          )}
          {input.model === "knn" && (
            <Slider
              label="邻居数 K"
              value={input.neighbors}
              display={String(input.neighbors)}
              min={1}
              max={21}
              step={2}
              onChange={(v) => setInput((p) => ({ ...p, neighbors: v }))}
            />
          )}
          {(input.model === "tree" || input.model === "forest") && (
            <Slider
              label="最大树深"
              value={input.depth}
              display={`${input.depth} 层`}
              min={1}
              max={12}
              step={1}
              onChange={(v) => setInput((p) => ({ ...p, depth: v }))}
            />
          )}
          <Slider
            label="训练池使用比例"
            value={input.fraction}
            display={`${Math.round(input.fraction * 100)}%`}
            min={0.25}
            max={1}
            step={0.05}
            onChange={(v) => condition({ fraction: v })}
          />
          {synthetic && (
            <Slider
              label="特征噪声 σ"
              value={input.noise}
              display={input.noise.toFixed(2)}
              min={0}
              max={0.45}
              step={0.01}
              onChange={(v) => condition({ noise: v })}
            />
          )}
          <label className="class-seed">
            配对划分种子
            <select
              aria-label="分类数据种子"
              value={input.seed}
              onChange={(e) =>
                condition({ seed: Number(e.target.value) as 42 | 43 | 44 })
              }
            >
              {[42, 43, 44].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          {input.edits.length > 0 && (
            <button
              className="text-button"
              onClick={() => setInput((p) => ({ ...p, edits: [] }))}
            >
              还原{input.edits.length}个训练点
            </button>
          )}
          <LabGuide>
            {result
              ? `${result.metrics.mistakes}个验证样本在当前条件下被错分。先找它们的位置，再判断边界是否过于简单或过于曲折。`
              : "先选一个案例，再想想：哪种边界能抓住它的规律？"}
          </LabGuide>
        </aside>
      </div>
      {result && (
        <>
          <div className="class-metrics">
            {[
              ["训练准确率", classPercent(result.metrics.train_accuracy)],
              ["验证准确率", classPercent(result.metrics.validation_accuracy)],
              ["平衡准确率", classPercent(result.metrics.balanced_accuracy)],
              [
                "验证错分",
                `${result.metrics.mistakes} / ${result.split.validation}`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="class-metric-note">
            平衡准确率是各类别召回率的平均值。当前使用{result.split.training}/
            {result.split.training_pool}个训练池样本；验证集
            {result.split.validation}个，独立测试仍封存。训练与验证差值为
            {(result.metrics.gap * 100).toFixed(1)}
            个百分点，单次差值不能单独判定过拟合。
          </p>
          <div className="class-review-grid">
            <section>
              <h2>错在哪里，比猜对多少更具体。</h2>
              <p>
                行=真实类别，列=预测类别。点一个非空格子，在图上定位对应样本。
              </p>
              <div
                className="class-confusion"
                style={{
                  gridTemplateColumns: `minmax(95px,1.4fr) repeat(${result.dataset.classes.length},minmax(0,1fr))`,
                }}
                role="table"
                aria-label="验证集混淆矩阵"
              >
                <div role="row">
                  <span role="columnheader">真实 ↓ / 预测 →</span>
                  {result.dataset.classes.map((name, i) => (
                    <strong role="columnheader" key={name} title={name}>
                      {String.fromCharCode(65 + i)}
                    </strong>
                  ))}
                </div>
                {result.confusion.map((row, i) => (
                  <div role="row" key={i}>
                    <strong role="rowheader" title={result.dataset.classes[i]}>
                      {String.fromCharCode(65 + i)}
                    </strong>
                    {row.map((count, j) => (
                      <div role="cell" key={j}>
                        <button
                          className={i === j ? "diagonal" : "off-diagonal"}
                          disabled={!count}
                          aria-label={`真实${result.dataset.classes[i]}，预测${result.dataset.classes[j]}，${count}个；定位样本`}
                          onClick={() =>
                            setSelected(
                              result.validation.find(
                                (p) => p.label === i && p.prediction === j,
                              )!.row,
                            )
                          }
                        >
                          {count}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <label className="class-mistake-picker">
                定位验证样本
                <select
                  aria-label="定位分类验证样本"
                  value={
                    result.validation.some((p) => p.row === selected)
                      ? selected!
                      : ""
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                >
                  <option value="">选择样本（错分在前）</option>
                  {[...result.validation]
                    .sort((a, b) => Number(a.correct) - Number(b.correct))
                    .map((p) => (
                      <option value={p.row} key={p.row}>
                        点{p.row + 1} · {p.correct ? "正确" : "错分"} ·{" "}
                        {result.dataset.classes[p.label]} →{" "}
                        {result.dataset.classes[p.prediction]}
                      </option>
                    ))}
                </select>
              </label>
            </section>
            <section className="class-prediction">
              <h2>先想一下，再用同一数据对照。</h2>
              <p>
                预测这组条件下哪种模型的验证准确率更高，再运行五种模型与多数类基线。不计正式课程成绩。
              </p>
              <label>
                我的探索预测
                <select
                  aria-label="分类模型探索预测"
                  value={prediction}
                  disabled={!!comparison || comparing}
                  onChange={(e) => setPrediction(e.target.value)}
                >
                  <option value="">选择一个模型</option>
                  {classModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  <option value="majority">多数类基线</option>
                </select>
              </label>
              <button
                className="button primary"
                disabled={!prediction || pending || comparing || !!comparison}
                onClick={() => void compare()}
              >
                {comparing
                  ? "正在配对计算…"
                  : comparison
                    ? "已完成本轮对照"
                    : "验证预测 · 运行模型对照"}
                <ArrowRight size={15} />
              </button>
              {compareError && (
                <p role="alert" className="class-compare-error">
                  {compareError}
                </p>
              )}
              {comparison && (
                <div className="class-comparison-result">
                  <strong>
                    {comparison.best.includes(prediction)
                      ? "预测属于本轮并列最佳，或唯一最佳。"
                      : "本轮实算没有支持这一预测。"}
                  </strong>
                  <p>{comparison.note}</p>
                  <table>
                    <caption>
                      按验证准确率比较，可能有并列；点击模型查看边界
                    </caption>
                    <thead>
                      <tr>
                        <th>模型</th>
                        <th>训练</th>
                        <th>验证</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.models.map((row) => (
                        <tr key={row.model}>
                          <td>
                            {row.model === "majority" ? (
                              row.name
                            ) : (
                              <button
                                onClick={() =>
                                  setInput((p) => ({
                                    ...p,
                                    model: row.model as ClassModel,
                                  }))
                                }
                              >
                                {row.name}
                                {comparison.best.includes(row.model)
                                  ? " · 本轮最佳"
                                  : ""}
                              </button>
                            )}
                          </td>
                          <td>{classPercent(row.train_accuracy)}</td>
                          <td>{classPercent(row.validation_accuracy)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
          <details className="class-method">
            <summary>数据来源、固定条件与复算参数</summary>
            <p>{result.protocol}</p>
            <p>
              {result.dataset.synthetic
                ? "合成数据用于解释机制，不能替代真实场景验证。"
                : "公开快照保持原始测量值；此处只使用图中两个特征，不代表全特征模型性能。"}{" "}
              来源：
              <a href={result.dataset.source} target="_blank" rel="noreferrer">
                {result.dataset.title}
              </a>{" "}
              · {result.dataset.license}
            </p>
            {result.dataset.citation && <p>{result.dataset.citation}</p>}
            <p>{result.dataset.transformation}</p>
            <p>
              数据指纹 {result.fingerprint} · 验证{" "}
              {result.validation_fingerprint} · 60棵森林树 ·
              边界为96×72格心预测近似。
            </p>
            <pre>{JSON.stringify(result.parameters, null, 2)}</pre>
          </details>
        </>
      )}
    </section>
  );
}
