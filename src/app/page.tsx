"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Layers3,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  X,
} from "lucide-react";
import { FitChart, ErrorChart } from "@/components/FitChart";
import {
  api,
  metric,
  quizzes,
  scenes,
  type Coach,
  type FinalResult,
  type Parameters,
  type Result,
  type SavedRecord,
  type SceneId,
  type Sweep,
} from "@/lib/experiment";

type View = "studio" | "path" | "history";
type Modal = "guide" | "save" | "report" | "final" | "sources" | "quiz" | null;
const alphaValues = [0.00000001, 0.000001, 0.0001, 0.01, 0.1, 1, 10, 100];
const alphaLabel = (a: number) =>
  a < 0.001 ? a.toExponential(0).replace("e-", " × 10⁻") : String(a);

export default function Home() {
  const [view, setView] = useState<View>("studio");
  const [params, setParams] = useState<Parameters>(scenes[0].defaults);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [records, setRecords] = useState<SavedRecord[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [completed, setCompleted] = useState<SceneId[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [question, setQuestion] = useState("");
  const [health, setHealth] = useState<{
    ai_configured: boolean;
    ai_model: string;
  } | null>(null);
  const [sweep, setSweep] = useState<Sweep | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [chartTab, setChartTab] = useState<"fit" | "sweep">("fit");
  const [final, setFinal] = useState<FinalResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportPreview, setReportPreview] = useState<{
    content: string;
    download_url: string;
    format: "json" | "md";
  } | null>(null);
  const coachAbort = useRef<AbortController | null>(null);
  const sweepAbort = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLElement | null>(null);
  const scene = scenes.find((s) => s.id === params.scene)!;
  const quiz = quizzes[params.scene];
  const comparison = records.filter((r) => selected.includes(r.id));

  useEffect(() => {
    api<{ ai_configured: boolean; ai_model: string }>("/health")
      .then(setHealth)
      .catch(() => {});
    api<SavedRecord[]>("/records")
      .then(setRecords)
      .catch(() => {});
    try {
      const stored = JSON.parse(
        localStorage.getItem("fitlab-progress") || "[]",
      );
      if (Array.isArray(stored))
        setCompleted(stored.filter((id) => scenes.some((s) => s.id === id)));
    } catch {}
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    coachAbort.current?.abort();
    setCoaching(false);
    setCoach(null);
    setFinal(null);
    setReportPreview(null);
    setBusy(true);
    setError("");
    const timeout = setTimeout(
      () =>
        api<Result>("/experiments/run", params, controller.signal)
          .then(setResult)
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setBusy(false);
          }),
      180,
    );
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [params, retry]);
  useEffect(() => {
    sweepAbort.current?.abort();
    setSweeping(false);
    setSweep(null);
  }, [params.samples, params.noise, params.alpha, params.seed, params.scene]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const elements = modalRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, textarea, a[href]",
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [modal]);

  function changeScene(id: SceneId) {
    setParams({ ...scenes.find((s) => s.id === id)!.defaults });
    setPrediction(null);
    setRevealed(false);
    setChartTab("fit");
    setView("studio");
    setMobileMenu(false);
  }
  function update<K extends keyof Parameters>(key: K, value: Parameters[K]) {
    setParams((p) => ({ ...p, [key]: value }));
  }
  async function askCoach(value = question) {
    if (!result || busy) return;
    const controller = new AbortController();
    coachAbort.current = controller;
    setCoaching(true);
    try {
      setCoach(
        await api<Coach>(
          "/coach",
          {
            parameters: params,
            question: value.trim() || "解释当前实验，并建议下一步操作。",
          },
          controller.signal,
        ),
      );
      setQuestion("");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setToast((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setCoaching(false);
    }
  }
  async function scan() {
    if (busy) return;
    const controller = new AbortController();
    sweepAbort.current = controller;
    setSweeping(true);
    setChartTab("sweep");
    try {
      setSweep(
        await api<Sweep>("/experiments/sweep", params, controller.signal),
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setToast((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setSweeping(false);
    }
  }
  async function save() {
    setSaving(true);
    try {
      await api("/records", {
        parameters: params,
        title: title.trim() || `${scene.short} · ${params.degree}阶模型`,
        note,
        prediction: prediction === null ? "" : scene.options[prediction],
      });
      setRecords(await api<SavedRecord[]>("/records"));
      setModal(null);
      setToast("实验已保存，可在实验档案中回放与比较。");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function answer() {
    setRevealed(true);
  }
  function answerQuiz() {
    setQuizRevealed(true);
    if (quizChoice === quiz.answer) {
      const next = Array.from(new Set([...completed, scene.id]));
      setCompleted(next);
      localStorage.setItem("fitlab-progress", JSON.stringify(next));
    }
  }
  async function evaluate() {
    setEvaluating(true);
    try {
      setFinal(await api<FinalResult>("/experiments/final", params));
      setModal(null);
      setToast("独立测试已完成，结果已加入当前报告。");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setEvaluating(false);
    }
  }
  async function exportReport(format: "json" | "md") {
    if (!result || busy || exporting) return;
    setExporting(true);
    try {
      const report = await api<{ json_url: string; markdown_url: string }>(
        "/reports",
        {
          parameters: params,
          final_evaluated: !!final,
          explanation: coach?.content || "",
          explanation_mode: coach?.mode || "none",
          explanation_model: coach?.model || null,
          record_ids: selected,
          learning_progress: completed,
        },
      );
      const reportId = report.json_url.split("/").pop()!.replace(".json", "");
      const preview = await api<{ content: string; download_url: string }>(
        `/reports/${reportId}/preview?format=${format}`,
      );
      setReportPreview({ ...preview, format });
      setToast("报告已生成，可预览、复制或下载。");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="sidebar-shade"
          aria-label="关闭导航"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <a href="/" className="brand">
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            看见过拟合<small>FITLAB · LEARNING BY DOING</small>
          </span>
        </a>
        <div className="workspace-label">
          我的学习空间<span>个人版</span>
        </div>
        <nav className="main-nav" aria-label="主导航">
          <button
            className={view === "studio" ? "active" : ""}
            onClick={() => {
              setView("studio");
              setMobileMenu(false);
            }}
          >
            <FlaskConical size={18} />
            实验工作台
            <span className="nav-active-dot" />
          </button>
          <button
            className={view === "path" ? "active" : ""}
            onClick={() => {
              setView("path");
              setMobileMenu(false);
            }}
          >
            <GraduationCap size={18} />
            学习路径<span className="nav-count">3</span>
          </button>
          <button
            className={view === "history" ? "active" : ""}
            onClick={() => {
              setView("history");
              setMobileMenu(false);
            }}
          >
            <FolderOpen size={18} />
            实验档案
            {records.length > 0 && (
              <span className="nav-count">{records.length}</span>
            )}
          </button>
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-label">
          交互实验<span>FOUNDATIONS</span>
        </div>
        <div className="lesson-nav">
          {scenes.map((s) => (
            <button
              key={s.id}
              className={
                view === "studio" && params.scene === s.id ? "selected" : ""
              }
              onClick={() => changeScene(s.id)}
            >
              <span
                className={`lesson-number ${completed.includes(s.id) ? "done" : ""}`}
              >
                {completed.includes(s.id) ? <Check size={13} /> : s.number}
              </span>
              <span>
                {s.short}
                <small>{s.tag}</small>
              </span>
              {params.scene === s.id && view === "studio" && (
                <ChevronRight size={14} />
              )}
            </button>
          ))}
        </div>
        <div className="sidebar-spacer" />
        <div className="journey-card">
          <div>
            <span className="tiny-spark">✦</span> 每一步，都看得见
          </div>
          <p>从记住概念，到建立直觉。</p>
          <div className="journey-progress">
            <span style={{ width: `${(completed.length / 3) * 100}%` }} />
          </div>
          <footer>
            <span>基础实验进度</span>
            <strong>{completed.length} / 3</strong>
          </footer>
        </div>
        <button className="help-link" onClick={() => setModal("sources")}>
          <CircleHelp size={17} />
          方法与数据来源
          <ArrowUpRight size={14} />
        </button>
        <div className="sidebar-user">
          <span className="avatar">研</span>
          <div>
            探索者<small>保持好奇，亲手验证</small>
          </div>
          <span className="user-dot" />
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              aria-label="展开导航"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>我的工作空间</span>
            <ChevronRight size={13} />
            <strong>
              {view === "studio"
                ? "实验工作台"
                : view === "path"
                  ? "学习路径"
                  : "实验档案"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="ai-status">
              <i />
              {health?.ai_configured ? "Flash 已配置" : "本地实验模式"}
            </span>
            <span className="topbar-separator" />
            <button className="text-button" onClick={() => setModal("guide")}>
              <BookOpen size={16} />
              使用指南
            </button>
            <span className="avatar small">研</span>
          </div>
        </header>

        <main className="content">
          {view === "studio" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span>交互实验 {scene.number}</span>
                    <span className="eyebrow-sep">/</span>
                    <span>机器学习基础</span>
                  </div>
                  <h1>
                    {scene.title}
                    <span className="level-badge">基础探索</span>
                  </h1>
                  <p>{scene.description}</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="button secondary"
                    disabled={!result || busy}
                    onClick={() => {
                      setTitle(`${scene.short} · ${params.degree}阶模型`);
                      setNote("");
                      setModal("save");
                    }}
                  >
                    <Save size={16} />
                    保存实验
                  </button>
                  <button
                    className="button primary"
                    disabled={!result || busy}
                    onClick={() => setModal("report")}
                  >
                    <ArrowDownToLine size={16} />
                    导出报告
                  </button>
                </div>
              </div>

              <div className="task-banner">
                <span className="task-icon">
                  <Target size={20} />
                </span>
                <div>
                  <strong>今天的探索任务</strong>
                  <span>{scene.task}</span>
                </div>
                <button
                  onClick={() =>
                    document
                      .getElementById("prediction")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                >
                  先做个预测
                  <ArrowRight size={15} />
                </button>
              </div>

              {error && (
                <div className="error-banner" role="alert">
                  <span>{error}</span>
                  <button onClick={() => setRetry((r) => r + 1)}>
                    重新连接
                  </button>
                </div>
              )}
              <div
                className={`metrics-grid ${busy ? "updating" : ""}`}
                aria-busy={busy}
              >
                <MetricCard
                  icon={<TrendingDown size={16} />}
                  label="训练误差"
                  tag="TRAIN MSE"
                  value={result ? metric(result.metrics.train_mse) : "—"}
                  color="teal"
                  caption={`${params.samples} 个样本 · 模型学习的数据`}
                />
                <MetricCard
                  icon={<Activity size={16} />}
                  label="验证误差"
                  tag="VALIDATION MSE"
                  value={result ? metric(result.metrics.validation_mse) : "—"}
                  color="coral"
                  caption="80 个样本 · 帮你选择参数"
                />
                <MetricCard
                  icon={<Layers3 size={16} />}
                  label="泛化差距"
                  tag="GENERALIZATION GAP"
                  value={result ? metric(result.metrics.gap) : "—"}
                  color="blue"
                  caption="验证误差 − 训练误差"
                />
                <div className="metric-card diagnosis-card">
                  <div className="metric-label">
                    <span>
                      <ShieldCheck size={16} />
                      当前诊断
                    </span>
                    <i
                      className={`status-dot ${result?.diagnosis.tone || ""}`}
                    />
                  </div>
                  <strong className="diagnosis-value">
                    {result?.diagnosis.label || "正在计算实验"}
                  </strong>
                  <p>
                    基于误差的教学提示
                    <span
                      className="metric-info"
                      title="规则诊断用于探索，不替代严格的统计检验。"
                    >
                      <CircleHelp size={13} />
                    </span>
                  </p>
                </div>
              </div>

              <div className="workspace-grid">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        <span className="panel-dot" />
                        看见模型如何拟合
                      </h2>
                      <p>改变右侧参数，观察曲线与误差的变化</p>
                    </div>
                    <span className="live-badge">
                      {busy ? (
                        <LoaderCircle size={12} className="spin" />
                      ) : (
                        <span />
                      )}
                      {busy ? "更新中" : "实时计算"}
                    </span>
                  </div>
                  <div className="chart-toolbar">
                    <div className="segmented">
                      <button
                        className={chartTab === "fit" ? "chosen" : ""}
                        onClick={() => setChartTab("fit")}
                      >
                        <Activity size={14} />
                        拟合曲线
                      </button>
                      <button
                        className={chartTab === "sweep" ? "chosen" : ""}
                        onClick={() => {
                          setChartTab("sweep");
                          if (!sweep && !sweeping) void scan();
                        }}
                      >
                        <BarChart3 size={14} />
                        复杂度扫描
                      </button>
                    </div>
                    <span className="chart-hint">
                      {chartTab === "fit"
                        ? "悬停探索数据点"
                        : "同一数据 · 比较 1—15 阶"}
                    </span>
                  </div>
                  {chartTab === "fit" && (
                    <div className="experiment-presets">
                      <span>快速对照</span>
                      {[1, 4, 15].map((degree) => (
                        <button
                          key={degree}
                          className={params.degree === degree ? "selected" : ""}
                          onClick={() => update("degree", degree)}
                        >
                          {degree} 阶模型
                        </button>
                      ))}
                      <small>保持其他条件不变</small>
                    </div>
                  )}
                  {chartTab === "fit" ? (
                    <FitChart result={result} />
                  ) : (
                    <div className="sweep-container">
                      {sweep ? (
                        <>
                          <ErrorChart data={sweep} current={params.degree} />
                          <div className="sweep-summary">
                            <span>
                              验证误差最小：
                              <strong>{sweep.best_degree} 阶</strong>
                            </span>
                            <button
                              className="text-button"
                              onClick={() => {
                                update("degree", sweep.best_degree);
                                setChartTab("fit");
                              }}
                            >
                              应用此阶数
                              <ArrowRight size={14} />
                            </button>
                          </div>
                          <p className="muted small-copy">
                            纵轴采用对数尺度。橙线为验证误差，青线为训练误差。最小值只针对当前数据与正则强度。
                          </p>
                        </>
                      ) : (
                        <div className="empty-chart">
                          <LoaderCircle
                            size={28}
                            className={sweeping ? "spin" : ""}
                          />
                          <p>
                            {sweeping
                              ? "正在比较不同复杂度…"
                              : "运行扫描，找到当前数据的平衡点。"}
                          </p>
                          {!sweeping && (
                            <button
                              className="button secondary"
                              onClick={() => void scan()}
                            >
                              开始扫描
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="chart-footer">
                    <span>
                      <ShieldCheck size={13} />
                      固定种子 {params.seed} · 独立数据划分
                    </span>
                    <span>
                      {result?.elapsed_ms ?? "—"} ms
                      <span className="subtle-dot">·</span>合成数据
                    </span>
                  </div>
                </section>

                <section className="panel parameters-panel">
                  <div className="panel-heading compact">
                    <h2>
                      <Settings2 size={17} />
                      实验参数
                    </h2>
                    <button
                      className="icon-button"
                      aria-label="重置当前实验参数"
                      title="重置参数"
                      onClick={() => setParams({ ...scene.defaults })}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                  <div className="parameter-controls">
                    <Slider
                      label="模型复杂度"
                      tag="多项式阶数"
                      value={params.degree}
                      display={`${params.degree}`}
                      min={1}
                      max={15}
                      step={1}
                      onChange={(v) => update("degree", v)}
                      left="1 · 简单"
                      right="15 · 复杂"
                    />
                    <div className="degree-preview">
                      ŷ = w₀ + w₁x + ··· + w{params.degree}x
                      <sup>{params.degree}</sup>
                    </div>
                    <Slider
                      label="训练样本"
                      tag="数据量"
                      value={params.samples}
                      display={`${params.samples} 个`}
                      min={12}
                      max={160}
                      step={1}
                      onChange={(v) => update("samples", v)}
                      left="12"
                      right="160"
                    />
                    <Slider
                      label="噪声水平"
                      tag="标准差 σ"
                      value={params.noise}
                      display={params.noise.toFixed(2)}
                      min={0}
                      max={0.6}
                      step={0.01}
                      onChange={(v) => update("noise", v)}
                      left="0 · 无噪声"
                      right="0.60"
                    />
                    <Slider
                      label="正则化强度"
                      tag="Ridge α"
                      value={Math.max(0, alphaValues.indexOf(params.alpha))}
                      display={alphaLabel(params.alpha)}
                      min={0}
                      max={7}
                      step={1}
                      onChange={(v) => update("alpha", alphaValues[v])}
                      left="弱约束"
                      right="强约束"
                    />
                  </div>
                  <div className="seed-row">
                    <span>随机种子</span>
                    <input
                      aria-label="随机种子"
                      type="number"
                      min="0"
                      max="999999"
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
                    <button
                      className="icon-button"
                      aria-label="更换随机种子"
                      title="更换种子"
                      onClick={() =>
                        update("seed", (params.seed + 1) % 1000000)
                      }
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                  <div className="parameter-tip">
                    <Lightbulb size={15} />
                    <span>一次只改变一个参数，更容易发现规律。</span>
                  </div>
                </section>
              </div>

              <div className="learning-grid">
                <section className="panel prediction-panel" id="prediction">
                  <div className="panel-heading compact">
                    <h2>
                      <Lightbulb size={17} />
                      先预测，再验证
                    </h2>
                    <span className="section-index">THINK FIRST</span>
                  </div>
                  <p className="question-text">{scene.question}</p>
                  <div
                    className="prediction-options"
                    role="radiogroup"
                    aria-label="实验预测"
                  >
                    {scene.options.map((option, index) => (
                      <button
                        role="radio"
                        aria-checked={prediction === index}
                        key={option}
                        className={`${prediction === index ? "selected" : ""} ${revealed && index === scene.answer ? "correct" : ""}`}
                        onClick={() => {
                          setPrediction(index);
                          setRevealed(false);
                        }}
                      >
                        <span className="radio-circle">
                          {revealed && index === scene.answer ? (
                            <Check size={11} />
                          ) : prediction === index ? (
                            <span />
                          ) : null}
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>
                  {revealed ? (
                    <div
                      className={`answer-feedback ${prediction === scene.answer ? "correct" : "retry"}`}
                    >
                      <strong>
                        {prediction === scene.answer
                          ? "理解得很准确"
                          : "再想一步，你会发现"}
                      </strong>
                      <p>{scene.reason}</p>
                      <button
                        className="text-button quiz-link"
                        onClick={() => {
                          setQuizChoice(null);
                          setQuizRevealed(false);
                          setModal("quiz");
                        }}
                      >
                        做一道迁移练习
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="prediction-footer">
                      <span>让直觉成为可检验的假设</span>
                      <button
                        className="button secondary small-button"
                        disabled={prediction === null}
                        onClick={answer}
                      >
                        验证我的预测
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </section>

                <section className="panel coach-panel">
                  <div className="panel-heading compact">
                    <h2>
                      <span className="coach-icon">
                        <Sparkles size={16} />
                      </span>
                      你的实验教练
                    </h2>
                    <span
                      className={`coach-mode ${coach?.mode === "online" ? "online" : ""}`}
                    >
                      {coach?.mode === "online"
                        ? "Flash 在线"
                        : coach?.mode === "rules"
                          ? "规则分析"
                          : "基于真实指标"}
                    </span>
                  </div>
                  {coach ? (
                    <div className="coach-response">
                      <div className="coach-response-text">{coach.content}</div>
                      {coach.notice && (
                        <p className="coach-notice">{coach.notice}</p>
                      )}
                      <div className="evidence-anchor">
                        <ShieldCheck size={12} />
                        依据当前实验 · {result?.data_fingerprint.slice(0, 8)}
                      </div>
                    </div>
                  ) : (
                    <div className="coach-intro">
                      <p>
                        曲线在变化，
                        <br />
                        <strong>背后的规律是什么？</strong>
                      </p>
                      <span>
                        让教练结合这次实验的真实指标，帮你理解现象，找到下一步。
                      </span>
                      <button
                        className="coach-ask"
                        disabled={busy || !result || coaching}
                        onClick={() => void askCoach()}
                      >
                        {coaching ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <Sparkles size={16} />
                        )}{" "}
                        {coaching ? "正在分析实验…" : "解读当前实验"}
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  )}
                  <form
                    className="coach-input"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void askCoach();
                    }}
                  >
                    <input
                      aria-label="向实验教练提问"
                      placeholder="为什么训练误差低，验证误差却很高？"
                      value={question}
                      maxLength={500}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                    <button
                      aria-label="发送问题"
                      disabled={busy || !result || coaching || !question.trim()}
                    >
                      {coaching ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <ArrowRight size={16} />
                      )}
                    </button>
                  </form>
                </section>
              </div>

              <section className="test-strip">
                <div className="test-strip-title">
                  <span className="test-lock">
                    <LockKeyhole size={19} />
                  </span>
                  <div>
                    <h3>
                      {final
                        ? "独立测试已揭示"
                        : "还有一份数据，留给最后的答案"}
                    </h3>
                    <p>
                      {final
                        ? `测试 MSE ${metric(final.test_mse)} · ${final.note}`
                        : "120 个独立测试样本暂不参与参数选择。选好模型后，再做一次最终评估。"}
                    </p>
                  </div>
                </div>
                <button
                  className="button secondary"
                  disabled={busy || !result || !!final}
                  onClick={() => setModal("final")}
                >
                  {final ? <CheckCheck size={15} /> : <ShieldCheck size={15} />}{" "}
                  {final ? "已完成评估" : "最终评估"}
                </button>
              </section>
              <footer className="page-footer">
                <span>理解，来自亲手探索。</span>
                <span>
                  FITLAB <i /> 可复现的机器学习实验
                </span>
              </footer>
            </>
          )}

          {view === "path" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">LEARNING PATH</div>
                  <h1>建立你的机器学习直觉</h1>
                  <p>三个小实验，理解模型、数据与约束如何一起影响泛化。</p>
                </div>
                <div className="path-total">
                  {completed.length}
                  <span>/ 3 已完成</span>
                </div>
              </div>
              <div className="path-grid">
                {scenes.map((s, index) => (
                  <section className="panel path-card" key={s.id}>
                    <div className={`path-illustration illustration-${index}`}>
                      <Activity size={78} strokeWidth={1} />
                      <span>{s.number}</span>
                    </div>
                    <div className="path-card-body">
                      <div className="eyebrow">
                        实验 {s.number} · {s.tag}
                      </div>
                      <h2>{s.title}</h2>
                      <p>{s.description}</p>
                      <div className="path-card-task">
                        <Target size={15} />
                        {s.task}
                      </div>
                      <button
                        className="button primary"
                        onClick={() => changeScene(s.id)}
                      >
                        {completed.includes(s.id) ? (
                          <Check size={16} />
                        ) : (
                          <Play size={15} />
                        )}{" "}
                        {completed.includes(s.id) ? "再次探索" : "开始实验"}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </section>
                ))}
              </div>
              <section className="panel learning-note">
                <ShieldCheck size={23} />
                <div>
                  <h3>先验证直觉，再相信结论。</h3>
                  <p>
                    课程完成状态保存在当前浏览器。实验记录保存在本地服务，可以跨页面查看与导出。
                  </p>
                </div>
              </section>
            </>
          )}

          {view === "history" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">EXPERIMENT NOTEBOOK</div>
                  <h1>每一次探索，都有迹可循</h1>
                  <p>回到某次实验，比较不同选择，找到你的证据。</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setView("studio")}
                >
                  <Plus size={16} />
                  继续实验
                </button>
              </div>
              {comparison.length > 0 && (
                <section className="panel comparison-panel">
                  <div className="panel-heading compact">
                    <h2>
                      <Layers3 size={17} />
                      实验对比
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => setSelected([])}
                    >
                      清空选择
                    </button>
                  </div>
                  <div className="comparison-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>实验</th>
                          <th>阶数</th>
                          <th>样本</th>
                          <th>噪声</th>
                          <th>正则 α</th>
                          <th>种子</th>
                          <th>训练 MSE</th>
                          <th>验证 MSE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.map((r) => (
                          <tr key={r.id}>
                            <td>{r.title}</td>
                            <td>{r.result.parameters.degree}</td>
                            <td>{r.result.parameters.samples}</td>
                            <td>{r.result.parameters.noise}</td>
                            <td>{alphaLabel(r.result.parameters.alpha)}</td>
                            <td>{r.result.parameters.seed}</td>
                            <td>{metric(r.result.metrics.train_mse)}</td>
                            <td>{metric(r.result.metrics.validation_mse)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted small-copy">
                    最多对比三组。比较单一因素时，记得保持种子及其他参数一致。已选记录也将包含在导出报告中。
                  </p>
                </section>
              )}
              {records.length === 0 ? (
                <section className="panel empty-history">
                  <FolderOpen size={42} strokeWidth={1} />
                  <h2>你的第一份实验记录，等你来写</h2>
                  <p>在工作台点击“保存实验”，留下参数、结果与思考。</p>
                  <button
                    className="button primary"
                    onClick={() => setView("studio")}
                  >
                    去做一次实验
                    <ArrowRight size={15} />
                  </button>
                </section>
              ) : (
                <div className="record-grid">
                  {records.map((r) => (
                    <article className="panel record-card" key={r.id}>
                      <div className="record-card-top">
                        <span className="eyebrow">
                          {
                            scenes.find(
                              (s) => s.id === r.result.parameters.scene,
                            )?.short
                          }
                        </span>
                        <label className="compare-check">
                          <input
                            type="checkbox"
                            checked={selected.includes(r.id)}
                            disabled={
                              !selected.includes(r.id) && selected.length >= 3
                            }
                            onChange={(e) =>
                              setSelected((ids) =>
                                e.target.checked
                                  ? [...ids, r.id]
                                  : ids.filter((id) => id !== r.id),
                              )
                            }
                          />
                          对比
                        </label>
                      </div>
                      <h2>{r.title}</h2>
                      <p className="record-time">
                        <Clock3 size={12} />
                        {new Date(r.created_at).toLocaleString("zh-CN")}
                      </p>
                      <div className="record-values">
                        <span>
                          训练 MSE
                          <strong>{metric(r.result.metrics.train_mse)}</strong>
                        </span>
                        <span>
                          验证 MSE
                          <strong>
                            {metric(r.result.metrics.validation_mse)}
                          </strong>
                        </span>
                      </div>
                      <p className="record-note">
                        {r.note ||
                          `${r.result.parameters.degree} 阶 · ${r.result.parameters.samples} 样本 · 噪声 ${r.result.parameters.noise}`}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => {
                          setParams({ ...r.result.parameters });
                          setPrediction(null);
                          setRevealed(false);
                          setView("studio");
                          setChartTab("fit");
                          setToast("已恢复实验参数；按同一随机种子重新计算。");
                        }}
                      >
                        载入并回放
                        <ArrowUpRight size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="关闭对话框"
              onClick={() => setModal(null)}
              autoFocus
            >
              <X size={20} />
            </button>
            {modal === "quiz" && (
              <>
                <span className="modal-icon">
                  <GraduationCap size={25} />
                </span>
                <h2 id="modal-title">把理解，带到新问题</h2>
                <p className="modal-description">{quiz.question}</p>
                <div
                  className="prediction-options quiz-options"
                  role="radiogroup"
                  aria-label="迁移练习"
                >
                  {quiz.options.map((option, index) => (
                    <button
                      role="radio"
                      aria-checked={quizChoice === index}
                      key={option}
                      className={`${quizChoice === index ? "selected" : ""} ${quizRevealed && index === quiz.answer ? "correct" : ""}`}
                      onClick={() => {
                        setQuizChoice(index);
                        setQuizRevealed(false);
                      }}
                    >
                      <span className="radio-circle">
                        {quizChoice === index && <span />}
                      </span>
                      {option}
                    </button>
                  ))}
                </div>
                {quizRevealed && (
                  <div
                    className={`answer-feedback ${quizChoice === quiz.answer ? "correct" : ""}`}
                  >
                    <strong>
                      {quizChoice === quiz.answer
                        ? "实验完成，进度已保存"
                        : "再试一次"}
                    </strong>
                    <p>{quiz.reason}</p>
                  </div>
                )}
                <button
                  className="button primary full-width"
                  disabled={quizChoice === null}
                  onClick={answerQuiz}
                >
                  <Check size={16} />
                  检查我的理解
                </button>
              </>
            )}
            {modal === "guide" && (
              <>
                <span className="modal-icon">
                  <BookOpen size={25} />
                </span>
                <h2 id="modal-title">一次实验，五个小步骤</h2>
                <p className="modal-description">
                  保持好奇，也给每个结论留下证据。
                </p>
                <ol className="guide-steps">
                  {[
                    "选择一个场景，先回答预测问题。",
                    "一次改变一个参数，观察曲线与验证误差。",
                    "保存几组实验，在档案中选择对比。",
                    "请教练解释当前指标，完成迁移练习。",
                    "确定模型后揭示独立测试，导出实验报告。",
                  ].map((text, index) => (
                    <li key={text}>
                      <span>{index + 1}</span>
                      {text}
                    </li>
                  ))}
                </ol>
                <button
                  className="button primary full-width"
                  onClick={() => setModal(null)}
                >
                  开始探索
                  <ArrowRight size={16} />
                </button>
              </>
            )}
            {modal === "save" && (
              <>
                <span className="modal-icon">
                  <Save size={25} />
                </span>
                <h2 id="modal-title">保存这次发现</h2>
                <p className="modal-description">
                  参数与计算结果会一起保存，随时可以回放。
                </p>
                <label className="field-label">
                  实验名称
                  <input
                    maxLength={80}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="为这次实验起个名字"
                  />
                </label>
                <label className="field-label">
                  我的观察
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="哪个变化让你意外？你想接着验证什么？"
                  />
                </label>
                <div className="save-preview">
                  <span>{params.degree} 阶模型</span>
                  <span>{params.samples} 个训练样本</span>
                  <span>种子 {params.seed}</span>
                </div>
                <button
                  className="button primary full-width"
                  disabled={saving || busy}
                  onClick={() => void save()}
                >
                  {saving ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}{" "}
                  {saving ? "正在保存…" : "保存到实验档案"}
                </button>
              </>
            )}
            {modal === "report" && (
              <>
                <span className="modal-icon">
                  <ArrowDownToLine size={25} />
                </span>
                <h2 id="modal-title">带走你的实验成果</h2>
                <p className="modal-description">
                  报告包含参数、真实指标、数据指纹、解释模式和已选对比记录。
                </p>
                <div className="report-preview">
                  <div>
                    <span>当前实验</span>
                    <strong>{scene.title}</strong>
                  </div>
                  <div>
                    <span>验证 MSE</span>
                    <strong>
                      {result && metric(result.metrics.validation_mse)}
                    </strong>
                  </div>
                  <div>
                    <span>独立测试</span>
                    <strong>{final ? "已完成" : "尚未揭示"}</strong>
                  </div>
                  <div>
                    <span>对比记录</span>
                    <strong>{comparison.length} 组</strong>
                  </div>
                </div>
                <div className="export-options">
                  <button
                    className="button primary"
                    onClick={() => exportReport("md")}
                    disabled={exporting || busy}
                  >
                    <ArrowDownToLine size={16} />
                    {exporting ? "正在生成…" : "Markdown 报告"}
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => exportReport("json")}
                    disabled={exporting || busy}
                  >
                    JSON 完整数据
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setModal(null);
                      setTimeout(() => window.print(), 100);
                    }}
                  >
                    打印 / 保存为 PDF
                    <ArrowUpRight size={14} />
                  </button>
                </div>
                {reportPreview && (
                  <div className="report-content-preview">
                    <label htmlFor="report-content">
                      {reportPreview.format === "json"
                        ? "JSON完整数据"
                        : "Markdown报告"}
                    </label>
                    <textarea
                      id="report-content"
                      aria-label="报告内容"
                      readOnly
                      value={reportPreview.content}
                    />
                    <div>
                      <button
                        className="button secondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              reportPreview.content,
                            );
                            setToast("报告内容已复制，可粘贴保存。");
                          } catch {
                            setToast("请在报告内容框中全选并复制。");
                          }
                        }}
                      >
                        复制报告
                      </button>
                      <a
                        className="button secondary"
                        href={"/api" + reportPreview.download_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        下载附件
                        <ArrowDownToLine size={14} />
                      </a>
                    </div>
                  </div>
                )}
              </>
            )}
            {modal === "final" && (
              <>
                <span className="modal-icon">
                  <LockKeyhole size={25} />
                </span>
                <h2 id="modal-title">准备好最终评估了吗？</h2>
                <p className="modal-description">
                  现在将用 120
                  个独立样本评估当前模型。它们没有参与训练或验证选择。
                </p>
                <div className="final-note">
                  看到结果后如果继续据此调参，这份测试数据就参与了选择。新的最终结论需要另一份独立测试数据。
                </div>
                <button
                  className="button primary full-width"
                  disabled={evaluating || busy}
                  onClick={() => void evaluate()}
                >
                  {evaluating ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <ShieldCheck size={16} />
                  )}{" "}
                  {evaluating ? "正在评估…" : "揭示独立测试结果"}
                </button>
              </>
            )}
            {modal === "sources" && (
              <>
                <span className="modal-icon">
                  <ShieldCheck size={25} />
                </span>
                <h2 id="modal-title">看得见，也能复现</h2>
                <p className="modal-description">
                  核心数据为明确标记的合成数据；图表与指标由Python计算，解释基于同一份证据。
                </p>
                <div className="source-list">
                  <div>
                    <strong>数据生成</strong>
                    <p>
                      cos(1.5πx) +
                      高斯噪声。三个独立随机流构造训练、验证和测试数据；随机种子可复现。
                    </p>
                  </div>
                  <div>
                    <strong>模型与诊断</strong>
                    <p>
                      多项式特征 → 训练集标准化 →
                      Ridge（SVD）。诊断是教学规则提示，并非统计检验。
                    </p>
                  </div>
                  <a
                    href="https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    scikit-learn 官方教学来源
                    <ArrowUpRight size={15} />
                  </a>
                  <a
                    href="https://archive.ics.uci.edu/dataset/186/wine+quality"
                    target="_blank"
                    rel="noreferrer"
                  >
                    后续真实数据扩展 · UCI Wine Quality
                    <ArrowUpRight size={15} />
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  tag,
  value,
  color,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  tag: string;
  value: string;
  color: string;
  caption: string;
}) {
  return (
    <div className={`metric-card ${color}`}>
      <div className="metric-label">
        <span>
          {icon}
          {label}
        </span>
        <small>{tag}</small>
      </div>
      <strong className="metric-value">{value}</strong>
      <p>{caption}</p>
    </div>
  );
}

function Slider({
  label,
  tag,
  value,
  display,
  min,
  max,
  step,
  onChange,
  left,
  right,
}: {
  label: string;
  tag: string;
  value: number;
  display: string;
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
        <label>
          {label}
          <small>{tag}</small>
        </label>
        <output>{display}</output>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={
          {
            "--range-fill": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="slider-extents">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}
