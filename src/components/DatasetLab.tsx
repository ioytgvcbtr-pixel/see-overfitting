"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  Check,
  ChevronRight,
  Database,
  FlaskConical,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/experiment";
import {
  initialBench,
  modelNames,
  number,
  type BenchCoach,
  type BenchParameters,
  type BenchResult,
  type Comparison,
  type Dataset,
  type DatasetId,
  type Learning,
  type ModelId,
  type Stability,
} from "@/lib/bench";
import { LearningChart, PredictionChart } from "@/components/BenchCharts";
import { MetricHelp } from "./LearningGuide";
import ActionExperiment from "./ActionExperiment";

type Display =
  "parity" | "residual" | "feature" | "learning" | "compare" | "stability";
type JournalEntry = {
  id: number;
  parameters: BenchParameters;
  title: string;
  validation_rmse: number;
  unit: string;
  fingerprint: string;
};
const displays: { id: Display; label: string }[] = [
  { id: "parity", label: "预测对照" },
  { id: "residual", label: "残差诊断" },
  { id: "feature", label: "特征关系" },
  { id: "learning", label: "学习曲线" },
  { id: "compare", label: "模型对照" },
  { id: "stability", label: "稳定性复核" },
];

export default function DatasetLab({
  onNotify,
}: {
  onNotify: (message: string) => void;
}) {
  const [catalog, setCatalog] = useState<Dataset[]>([]);
  const [params, setParams] = useState<BenchParameters>(initialBench);
  const [result, setResult] = useState<BenchResult | null>(null);
  const [loading, setBusy] = useState(true),
    [error, setError] = useState("");
  const busy =
    loading ||
    (!!result &&
      (Object.keys(params) as (keyof BenchParameters)[]).some(
        (key) => params[key] !== result.parameters[key],
      ));
  const [display, setDisplay] = useState<Display>("parity");
  const [feature, setFeature] = useState(0),
    [showTraining, setShowTraining] = useState(false);
  const [learning, setLearning] = useState<Learning | null>(null),
    [comparison, setComparison] = useState<Comparison | null>(null),
    [stability, setStability] = useState<Stability | null>(null);
  const [computing, setComputing] = useState(false);
  const [coach, setCoach] = useState<BenchCoach | null>(null),
    [coaching, setCoaching] = useState(false);
  const [journal, setJournal] = useState<JournalEntry[]>([]),
    [journalOpen, setJournalOpen] = useState(false);
  const [exposed, setExposed] = useState<DatasetId[]>([]),
    [consent, setConsent] = useState(false);
  const [finalResult, setFinalResult] = useState<{
      test_rmse: number;
      test_r2: number;
      test_samples: number;
      note: string;
    } | null>(null),
    [evaluating, setEvaluating] = useState(false);
  const [retry, setRetry] = useState(0);
  const analysisAbort = useRef<AbortController | null>(null),
    coachAbort = useRef<AbortController | null>(null),
    finalAbort = useRef<AbortController | null>(null);
  const selected = catalog.find((item) => item.id === params.dataset);
  const previouslyViewed = exposed.includes(params.dataset);

  useEffect(() => {
    api<Dataset[]>("/datasets")
      .then(setCatalog)
      .catch((e) => {
        setError(e.message);
        setBusy(false);
      });
  }, [retry]);
  useEffect(() => {
    try {
      const rows = JSON.parse(
        localStorage.getItem("fitlab-bench-records") || "[]",
      );
      if (Array.isArray(rows)) setJournal(rows.slice(0, 12));
      const seen = JSON.parse(
        localStorage.getItem("fitlab-test-exposure") || "[]",
      );
      if (Array.isArray(seen))
        setExposed(
          seen.filter((id) => ["wine", "auto", "concrete"].includes(id)),
        );
    } catch {}
  }, []);
  useEffect(() => {
    if (!catalog.length) return;
    const controller = new AbortController();
    analysisAbort.current?.abort();
    coachAbort.current?.abort();
    finalAbort.current?.abort();
    setBusy(true);
    setError("");
    setLearning(null);
    setComparison(null);
    setStability(null);
    setCoach(null);
    setCoaching(false);
    setComputing(false);
    setFinalResult(null);
    setConsent(false);
    setEvaluating(false);
    setResult((previous) =>
      previous?.dataset.id === params.dataset ? previous : null,
    );
    const timer = setTimeout(
      () =>
        api<BenchResult>("/bench/run", params, controller.signal)
          .then(setResult)
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setBusy(false);
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
      analysisAbort.current?.abort();
      coachAbort.current?.abort();
      finalAbort.current?.abort();
    };
  }, [params, catalog.length, retry]);

  const update = <K extends keyof BenchParameters>(
    key: K,
    value: BenchParameters[K],
  ) => setParams((previous) => ({ ...previous, [key]: value }));
  async function analyze(next: Display) {
    setDisplay(next);
    if (!["learning", "compare", "stability"].includes(next) || busy) return;
    if (
      (next === "learning" && learning) ||
      (next === "compare" && comparison) ||
      (next === "stability" && stability)
    )
      return;
    analysisAbort.current?.abort();
    const controller = new AbortController();
    analysisAbort.current = controller;
    setComputing(true);
    try {
      if (next === "learning")
        setLearning(
          await api<Learning>("/bench/learning", params, controller.signal),
        );
      if (next === "compare")
        setComparison(
          await api<Comparison>("/bench/compare", params, controller.signal),
        );
      if (next === "stability")
        setStability(
          await api<Stability>("/bench/stability", params, controller.signal),
        );
    } catch (e) {
      if ((e as Error).name !== "AbortError") onNotify((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setComputing(false);
    }
  }
  async function askCoach() {
    if (!result || busy) return;
    const controller = new AbortController();
    coachAbort.current = controller;
    setCoaching(true);
    try {
      setCoach(
        await api<BenchCoach>(
          "/bench/coach",
          {
            ...params,
            with_comparison: !!comparison,
            with_stability: !!stability,
            test_previously_viewed: previouslyViewed,
          },
          controller.signal,
        ),
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") onNotify((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setCoaching(false);
    }
  }
  function save() {
    if (!result || busy) return;
    const item: JournalEntry = {
      id: Date.now(),
      parameters: { ...params },
      title: `${result.dataset.title} · ${result.model_name}`,
      validation_rmse: result.metrics.validation_rmse,
      unit: result.dataset.unit,
      fingerprint: result.fingerprint,
    };
    const next = [item, ...journal].slice(0, 12);
    setJournal(next);
    localStorage.setItem("fitlab-bench-records", JSON.stringify(next));
    onNotify("已收藏实验条件，当前浏览器保留最近12条记录。");
  }
  async function evaluate() {
    if (!result || busy) return;
    const controller = new AbortController();
    finalAbort.current = controller;
    setEvaluating(true);
    try {
      const value = await api<{
        test_rmse: number;
        test_r2: number;
        test_samples: number;
        note: string;
      }>("/bench/final", params, controller.signal);
      setFinalResult(value);
      const next = Array.from(new Set([...exposed, params.dataset]));
      setExposed(next);
      localStorage.setItem("fitlab-test-exposure", JSON.stringify(next));
    } catch (e) {
      if ((e as Error).name !== "AbortError") onNotify((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setEvaluating(false);
    }
  }

  return (
    <div className="dataset-lab">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span>迁移实验</span>
            <span>/</span>
            <span>真实数据</span>
          </div>
          <h1>
            用真实数据检验你的判断<span className="level-badge">进阶探索</span>
          </h1>
          <p>先看预测，再比较模型，最后复核结论。</p>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            onClick={() => setJournalOpen(!journalOpen)}
          >
            <Layers3 size={16} />
            实验收藏 {journal.length > 0 && `(${journal.length})`}
          </button>
          <button
            className="button secondary"
            disabled={!result || busy}
            onClick={save}
          >
            <Bookmark size={16} />
            收藏本次实验
          </button>
        </div>
      </div>

      <div className="dataset-cards">
        {catalog.map((dataset) => (
          <button
            className={`dataset-card ${dataset.color} ${params.dataset === dataset.id ? "chosen" : ""}`}
            key={dataset.id}
            aria-pressed={params.dataset === dataset.id}
            onClick={() => {
              setBusy(true);
              setResult(null);
              update("dataset", dataset.id);
              setFeature(0);
              setDisplay("parity");
            }}
          >
            <div className="dataset-card-top">
              <span className="dataset-icon">
                <Database size={19} />
              </span>
              <span>{dataset.domain}</span>
              {params.dataset === dataset.id && <Check size={16} />}
            </div>
            <h2>
              {dataset.title}
              <ArrowUpRight size={15} />
            </h2>
            <p>{dataset.subtitle}</p>
            <div className="dataset-card-footer">
              <strong>
                {dataset.rows.toLocaleString()}
                <small> 条记录</small>
              </strong>
              <span>{dataset.features.length} 个特征</span>
              <span>CC BY 4.0</span>
            </div>
          </button>
        ))}
      </div>
      {!catalog.length && !error && (
        <div className="panel bench-loading">
          <LoaderCircle className="spin" size={24} />
          正在核验公开数据快照…
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setRetry((value) => value + 1)}>
            重新连接
          </button>
        </div>
      )}

      {journalOpen && (
        <section className="panel bench-journal">
          <div className="panel-heading compact">
            <h2>
              <Bookmark size={16} />
              当前浏览器的实验收藏
            </h2>
            <span className="muted small-copy">点击恢复条件并重新计算</span>
          </div>
          {journal.length ? (
            <div className="bench-journal-list">
              {journal.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setBusy(true);
                    setResult(null);
                    setParams({ ...item.parameters });
                    setFeature(0);
                    setDisplay("parity");
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>
                    验证RMSE {number(item.validation_rmse)} {item.unit}
                  </span>
                  <small>
                    seed {item.parameters.seed} · 训练池{" "}
                    {Math.round(item.parameters.fraction * 100)}%
                  </small>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <p className="bench-empty-copy">
              完成一次实验后，点击“收藏本次实验”，保留可回放的条件和指标。
            </p>
          )}
        </section>
      )}

      {selected && (
        <>
          <div className="bench-workspace">
            <section className="panel bench-visual-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    <span className="panel-dot" />
                    {selected.title}：{modelNames[params.model]}
                  </h2>
                  <p>
                    {selected.target}，单位 {selected.unit}
                    。图表与指标均来自当前计算。
                  </p>
                </div>
                <span className="live-badge">
                  {busy ? (
                    <LoaderCircle size={12} className="spin" />
                  ) : (
                    <span />
                  )}
                  {busy ? "计算中" : "计算完成"}
                </span>
              </div>
              <div className="bench-guidance">
                <div>
                  <strong>
                    {!comparison
                      ? "同一批数据上，哪个模型的验证误差更低？"
                      : !stability
                        ? "换三次划分，刚才的结论还成立吗？"
                        : "把误差和波动一起看，解释你的模型选择。"}
                  </strong>
                  <p>
                    {!comparison
                      ? "先运行一次模型对照，所有模型使用相同的数据条件。"
                      : !stability
                        ? "对照已完成。用配对划分检查结果的稳定程度。"
                        : "复核已完成。AI会依据这些实际结果帮助你梳理发现。"}
                  </p>
                </div>
                <button
                  className="button primary"
                  disabled={!result || busy || computing || coaching}
                  onClick={() => {
                    if (!comparison) void analyze("compare");
                    else if (!stability) void analyze("stability");
                    else {
                      void askCoach();
                      document.querySelector(".bench-coach")?.scrollIntoView({
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "auto"
                          : "smooth",
                        block: "center",
                      });
                    }
                  }}
                >
                  {computing
                    ? "正在计算…"
                    : coaching
                      ? "正在讲解…"
                      : !comparison
                        ? "比较模型"
                        : !stability
                          ? "复核结论"
                          : "解释本次结果"}
                  <ArrowRight size={15} />
                </button>
              </div>
              <div
                className="bench-display-tabs"
                role="tablist"
                aria-label="实验展示方式"
                onKeyDown={(event) => {
                  if (event.ctrlKey || event.metaKey || event.altKey) return;
                  const index = displays.findIndex(
                    (item) => item.id === display,
                  );
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % displays.length
                      : event.key === "ArrowLeft"
                        ? (index - 1 + displays.length) % displays.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? displays.length - 1
                            : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  event.currentTarget
                    .querySelectorAll<HTMLButtonElement>("button")
                    [next]?.focus();
                  void analyze(displays[next].id);
                }}
              >
                {displays.map((item) => (
                  <button
                    key={item.id}
                    role="tab"
                    aria-selected={display === item.id}
                    tabIndex={display === item.id ? 0 : -1}
                    className={display === item.id ? "selected" : ""}
                    onClick={() => void analyze(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {result &&
                ["parity", "residual", "feature"].includes(display) && (
                  <>
                    <div className="bench-chart-options">
                      {display === "feature" ? (
                        <label>
                          选择特征
                          <select
                            aria-label="特征关系字段"
                            value={feature}
                            onChange={(e) => setFeature(Number(e.target.value))}
                          >
                            {selected.features.map((name, index) => (
                              <option key={name} value={index}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <span>
                          {display === "parity"
                            ? "越靠近对角线，预测越接近真实值"
                            : "观察误差是否随预测值呈现结构"}
                        </span>
                      )}
                      <label>
                        <input
                          type="checkbox"
                          checked={showTraining}
                          onChange={(e) => setShowTraining(e.target.checked)}
                        />
                        显示训练样本
                      </label>
                    </div>
                    <PredictionChart
                      result={result}
                      mode={display as "parity" | "residual" | "feature"}
                      feature={feature}
                      showTraining={showTraining}
                    />
                  </>
                )}
              {display === "learning" && learning && (
                <LearningChart data={learning} unit={selected.unit} />
              )}
              {display === "compare" && comparison && (
                <div className="bench-comparison">
                  <div className="bench-analysis-heading">
                    <span>同一划分 · 同一训练占比</span>
                    <strong>本次验证误差最低：{comparison.best}</strong>
                  </div>
                  {comparison.models.map((model) => (
                    <div
                      className={`bench-model-row ${model.model === params.model ? "current" : ""}`}
                      key={model.model}
                    >
                      <div>
                        <strong>{model.name}</strong>
                        <small>
                          {model.model === "mean"
                            ? "只预测训练均值"
                            : model.model === params.model
                              ? "当前模型"
                              : "对照模型"}
                        </small>
                      </div>
                      <div className="bench-bar-track">
                        <i
                          style={{
                            width: `${(model.validation_rmse / Math.max(...comparison.models.map((row) => row.validation_rmse))) * 100}%`,
                          }}
                        />
                      </div>
                      <span>
                        {number(model.validation_rmse)}
                        <small>RMSE · {selected.unit}</small>
                      </span>
                    </div>
                  ))}
                  <p className="bench-analysis-note">
                    条形从零起点编码验证RMSE，越低越好。该结果只针对当前数据和参数；可继续做配对种子复核。
                    岭回归 α={params.alpha}；树与森林最大深度={params.depth}
                    ；森林使用60棵树。
                  </p>
                </div>
              )}
              {display === "stability" && stability && (
                <div className="bench-stability">
                  <div className="bench-analysis-heading">
                    <span>3次配对划分 · 不查看测试</span>
                    <strong>
                      {stability.ranking_agrees
                        ? "三次划分的最佳模型一致"
                        : "最佳模型随划分变化"}
                    </strong>
                  </div>
                  <div className="comparison-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>随机种子</th>
                          <th>岭回归 RMSE</th>
                          <th>决策树 RMSE</th>
                          <th>随机森林 RMSE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stability.runs.map((row) => (
                          <tr key={row.seed}>
                            <td>{row.seed}</td>
                            {(["ridge", "tree", "forest"] as const).map(
                              (model) => (
                                <td key={model}>
                                  {number(
                                    row.models.find(
                                      (item) => item.model === model,
                                    )!.validation_rmse,
                                  )}
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bench-stability-summary">
                    {stability.summary.map((item) => (
                      <div key={item.model}>
                        <span>{item.name}</span>
                        <strong>
                          {number(item.mean)}{" "}
                          <small>± {number(item.std)}</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="bench-analysis-note">
                    {stability.note} 单位均为 {selected.unit}。
                  </p>
                </div>
              )}
              {(!result ||
                computing ||
                (display === "learning" && !learning) ||
                (display === "compare" && !comparison) ||
                (display === "stability" && !stability)) && (
                <div className="bench-analysis-empty">
                  {busy || computing ? (
                    <LoaderCircle size={25} className="spin" />
                  ) : (
                    <BarChart3 size={27} />
                  )}
                  <p>
                    {busy
                      ? "正在计算当前条件…"
                      : computing
                        ? "正在复核同一组实验条件…"
                        : "条件已改变，请重新运行这一项分析。"}
                  </p>
                  {!busy && !computing && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        if (!result) setRetry((value) => value + 1);
                        else void analyze(display);
                      }}
                    >
                      计算{displays.find((item) => item.id === display)?.label}
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
              <div
                className={`metrics-grid bench-metrics ${busy ? "updating" : ""}`}
              >
                <BenchMetric
                  label="训练 RMSE"
                  value={
                    result && !busy ? number(result.metrics.train_rmse) : "—"
                  }
                  caption={`${result?.split.training ?? "—"} 条训练数据`}
                  unit={selected.unit}
                />
                <BenchMetric
                  label="验证 RMSE"
                  value={
                    result && !busy
                      ? number(result.metrics.validation_rmse)
                      : "—"
                  }
                  caption={`${result?.split.validation ?? "—"} 条验证数据`}
                  unit={selected.unit}
                />
                <BenchMetric
                  label="验证 R²"
                  value={
                    result && !busy ? number(result.metrics.validation_r2) : "—"
                  }
                  caption="可为负值；衡量当前验证表现"
                />
                <BenchMetric
                  label="泛化差距"
                  value={result && !busy ? number(result.metrics.gap) : "—"}
                  caption="验证RMSE − 训练RMSE"
                  unit={selected.unit}
                />
              </div>
              <MetricHelp kind="rmse" unit={selected.unit} />
              <details className="bench-protocol">
                <summary>
                  <ShieldCheck size={15} />
                  怎样保证这次比较公平？<span>查看数据划分</span>
                </summary>
                <p>
                  相同特征的重复记录按组划分，避免跨集合泄漏；按组分为60%训练池、20%验证、20%测试。预处理只拟合当前训练数据，验证集用于选参。测试接触状态记录在本浏览器。
                </p>
              </details>{" "}
              <footer className="chart-footer">
                <span>
                  快照 {selected.version.slice(0, 8)} · seed {params.seed}
                </span>
                <span>
                  {result?.elapsed_ms ?? "—"} ms ·{" "}
                  {result?.fingerprint.slice(0, 8) ?? "—"}
                </span>
              </footer>
            </section>
            <aside className="bench-side">
              <section className="panel bench-settings">
                <div className="panel-heading compact">
                  <h2>
                    <FlaskConical size={17} />
                    控制实验条件
                  </h2>
                  <button
                    className="icon-button"
                    aria-label="重置真实数据实验"
                    onClick={() =>
                      setParams({ ...initialBench, dataset: params.dataset })
                    }
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
                <div className="bench-settings-body">
                  <label className="bench-field-label">模型</label>
                  <div className="bench-model-buttons">
                    {(Object.keys(modelNames) as ModelId[]).map((model) => (
                      <button
                        key={model}
                        aria-pressed={params.model === model}
                        className={params.model === model ? "chosen" : ""}
                        onClick={() => update("model", model)}
                      >
                        {modelNames[model]}
                      </button>
                    ))}
                  </div>
                  <p className="bench-setting-description">
                    {params.model === "ridge"
                      ? "线性模型，用L2约束平衡拟合与稳定性。"
                      : params.model === "tree"
                        ? "用树深控制复杂度，观察局部拟合。"
                        : "60棵树进行集成，比较同一深度下的表现。"}
                  </p>
                  {params.model !== "ridge" ? (
                    <BenchSlider
                      label="最大树深"
                      value={params.depth}
                      output={`${params.depth} 层`}
                      min={1}
                      max={15}
                      step={1}
                      onChange={(v) => update("depth", v)}
                      left="简单"
                      right="复杂"
                    />
                  ) : (
                    <BenchSlider
                      label="正则化强度 α"
                      value={Math.log10(params.alpha)}
                      output={
                        params.alpha < 0.01
                          ? params.alpha.toExponential(0)
                          : String(params.alpha)
                      }
                      min={-6}
                      max={3}
                      step={1}
                      onChange={(v) => update("alpha", 10 ** v)}
                      left="弱约束"
                      right="强约束"
                    />
                  )}
                  <BenchSlider
                    label="训练池使用比例"
                    value={params.fraction}
                    output={`${Math.round(params.fraction * 100)}%`}
                    min={0.1}
                    max={1}
                    step={0.05}
                    onChange={(v) => update("fraction", v)}
                    left="10%"
                    right="100%"
                  />
                  <div className="bench-fixed-split">
                    <span>训练 {result?.split.training ?? "—"}</span>
                    <span>验证 {result?.split.validation ?? "—"}</span>
                    <span>测试 {result?.split.test ?? "—"}</span>
                  </div>
                  <label className="bench-seed">
                    随机种子
                    <input
                      aria-label="真实数据随机种子"
                      type="number"
                      min={0}
                      max={999999}
                      value={params.seed}
                      onChange={(e) =>
                        update(
                          "seed",
                          Math.max(
                            0,
                            Math.min(999999, Number(e.target.value) || 0),
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="bench-interventions">
                    <span>只改变一个因素</span>
                    {params.model === "ridge"
                      ? [0.01, 1, 100].map((alpha) => (
                          <button
                            key={alpha}
                            onClick={() => update("alpha", alpha)}
                          >
                            α {alpha}
                          </button>
                        ))
                      : [2, 5, 12].map((depth) => (
                          <button
                            key={depth}
                            onClick={() => update("depth", depth)}
                          >
                            {depth} 层
                          </button>
                        ))}
                  </div>
                </div>
              </section>
              <section className="panel bench-coach">
                <div className="panel-heading compact">
                  <h2>
                    <Sparkles size={17} />
                    实验讲解
                  </h2>
                  <span
                    className="coach-mode"
                    title="DeepSeek兼容将xhigh映射为原生high"
                  >
                    {coach?.mode === "online"
                      ? "AI讲解"
                      : coach?.mode === "rules"
                        ? "规则讲解"
                        : "基于实验"}
                  </span>
                </div>
                <div className="bench-coach-body">
                  {coach ? (
                    <>
                      <p className="bench-coach-text">{coach.content}</p>
                      {coach.notice && (
                        <p className="coach-notice">{coach.notice}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <h3>先看数字，再解释原因</h3>
                      <p>
                        讲解会结合这次实验的指标、模型对照和划分复核，说明现象与下一步操作。
                      </p>
                    </>
                  )}
                  <div className="bench-evidence-tags">
                    <span>
                      <Check size={11} />
                      当前指标
                    </span>
                    {comparison && (
                      <span>
                        <Check size={11} />
                        模型对照
                      </span>
                    )}
                    {stability && (
                      <span>
                        <Check size={11} />
                        配对复核
                      </span>
                    )}
                  </div>
                  <button
                    className="button secondary full-width"
                    disabled={!result || busy || coaching || computing}
                    onClick={() => void askCoach()}
                  >
                    {coaching ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : (
                      <Sparkles size={15} />
                    )}{" "}
                    {coaching
                      ? "正在梳理结果…"
                      : coach
                        ? "重新讲解"
                        : "解释本次结果"}
                  </button>
                  <button
                    className="text-button bench-action-link"
                    onClick={() =>
                      document
                        .getElementById("bench-action")
                        ?.scrollIntoView({
                          block: "start",
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "instant"
                            : "smooth",
                        })
                    }
                  >
                    用实验检验一个建议
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            </aside>
          </div>
          <section className="panel bench-action-workbench" id="bench-action">
            <ActionExperiment
              kind="bench"
              parameters={params}
              enabled={!busy && !!result && !computing}
              previouslyViewed={previouslyViewed}
              onApply={(value) => setParams(value as BenchParameters)}
            />
          </section>
          <section
            className={`bench-test panel ${previouslyViewed ? "exposed" : ""}`}
          >
            <div className="bench-test-intro">
              <span className="test-lock">
                <LockKeyhole size={19} />
              </span>
              <div>
                <h3>
                  {previouslyViewed
                    ? "这个数据集的测试结果已被查看"
                    : "把独立测试，留给最后一次判断"}
                </h3>
                <p>
                  {previouslyViewed
                    ? "本浏览器已记录测试接触。继续据此调参属于探索，重新划分同一数据也不等同于独立新数据。"
                    : "模型选择使用验证集。查看后会记录本次测试接触，避免把已见结果重新标成未见测试。"}
                </p>
              </div>
            </div>
            {finalResult ? (
              <div className="bench-final-values">
                <span>
                  测试 RMSE{" "}
                  <strong>
                    {number(finalResult.test_rmse)} {selected.unit}
                  </strong>
                </span>
                <span>
                  测试 R² <strong>{number(finalResult.test_r2)}</strong>
                </span>
                <small>{finalResult.test_samples} 条 · 探索记录</small>
              </div>
            ) : (
              <div className="bench-test-action">
                <label>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  我已完成选参，了解测试接触的含义
                </label>
                <button
                  className="button secondary"
                  disabled={!consent || busy || evaluating}
                  onClick={() => void evaluate()}
                >
                  {evaluating ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <ShieldCheck size={14} />
                  )}{" "}
                  {previouslyViewed ? "查看测试 · 探索" : "最终评估"}
                </button>
              </div>
            )}
          </section>
          <details className="bench-data-details">
            <summary>
              <Database size={15} />
              数据来源与处理说明
              <ChevronRight size={14} />
            </summary>
            <div>
              <p>{selected.citation}</p>
              <p>
                保留 {selected.rows} 条记录；移除缺失行{" "}
                {selected.removed_missing_rows} 条；
                {selected.unique_feature_groups}{" "}
                个不同特征组。重复特征记录按组进入同一集合。数值标准化与产地类别编码仅拟合训练集。
              </p>
              <p>
                不同数据集的RMSE单位不同，不用于跨数据集直接排名。学习曲线、对照和复核只使用训练与验证数据。
              </p>
              <a href={selected.source} target="_blank" rel="noreferrer">
                UCI 原始来源
                <ArrowUpRight size={13} />
              </a>
              <a href={selected.license_url} target="_blank" rel="noreferrer">
                {selected.license}
                <ArrowUpRight size={13} />
              </a>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function BenchMetric({
  label,
  value,
  caption,
  unit,
}: {
  label: string;
  value: string;
  caption: string;
  unit?: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">
        <span>{label}</span>
        {unit && <small>{unit}</small>}
      </div>
      <strong className="metric-value">{value}</strong>
      <p>{caption}</p>
    </div>
  );
}
function BenchSlider({
  label,
  value,
  output,
  min,
  max,
  step,
  onChange,
  left,
  right,
}: {
  label: string;
  value: number;
  output: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  left: string;
  right: string;
}) {
  return (
    <div className="slider-control">
      <div className="slider-title">
        <label>{label}</label>
        <output>{output}</output>
      </div>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            "--range-fill": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
      <div className="slider-extents">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}
