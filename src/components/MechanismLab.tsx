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
  CircleHelp,
  FlaskConical,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  X,
} from "lucide-react";
import { FitChart, ErrorChart } from "@/components/FitChart";
import ExperimentControls from "@/components/ExperimentControls";
import {
  JourneySteps,
  PredictionGate,
  PredictionReview,
  TransferValidation,
} from "@/components/LearningJourney";
import { useLearningJourney } from "@/components/useLearningJourney";
import ActionExperiment from "@/components/ActionExperiment";
import {type Health,type WorkspaceOverview,type WorkspaceEntry} from "@/lib/workspace";
import type {IslandAttempt,IslandLaunch,IslandId} from "@/lib/island-learning";
import ConceptWorkshop from "@/components/ConceptWorkshop";
import ClassificationLab from "@/components/ClassificationLab";
import PlanetPortal from "@/components/planet/PlanetPortal";
import type { ConceptPanel } from "@/lib/concepts";
import type { ClassRecipeId } from "@/lib/exploration";
import {
  LearningMission,
  ObservationBoard,
  MetricHelp,
} from "@/components/LearningGuide";
import { lessonGuide, type ObservationSet } from "@/lib/learning-guide";
import type { AppView } from "@/lib/navigation";
import {
  api,
  metric,
  scenes,
  type Coach,
  type FinalResult,
  type Parameters,
  type Result,
  type SavedRecord,
  type SceneId,
  type Sweep,
} from "@/lib/experiment";

type View = AppView;
type Modal = "save" | "report" | "final" | "sources" | null;
const alphaLabel = (a: number) =>
  a < 0.001 ? a.toExponential(0).replace("e-", " × 10⁻") : String(a);

export default function MechanismLab({section="concepts",onSectionChange,topicRequest,resumeRequest}:{section?:AppView;onSectionChange:(view:AppView)=>void;topicRequest?:{panel:ConceptPanel;serial:number}|null;resumeRequest?:{entry:WorkspaceEntry;serial:number}|null}) {
  const [view, setViewState] = useState<View>(section);
  const [classLaunch, setClassLaunch] = useState<ClassRecipeId | null>(null);
  const [conceptLaunch, setConceptLaunch] = useState<ConceptPanel | null>(null);
  const [islandLaunch,setIslandLaunch]=useState<IslandLaunch|null>(null);
  const [workspaceRevision,setWorkspaceRevision]=useState(0);
  const [serviceError,setServiceError]=useState(""),[workspaceError,setWorkspaceError]=useState("");
  const [params, setParams] = useState<Parameters>(scenes[0].defaults);
  const [sceneReady, setSceneReady] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setBusy] = useState(true);
  const busy =
    loading ||
    (!!result &&
      (Object.keys(params) as (keyof Parameters)[]).some(
        (key) => params[key] !== result.parameters[key],
      ));
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [actionIds, setActionIds] = useState<string[]>([]);
  const [completed, setCompleted] = useState<SceneId[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [question, setQuestion] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
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
  const guide = lessonGuide(params);
  const journey = useLearningJourney(params, setParams, sceneReady);
  const canReveal = journey.ready && !!journey.activeId;
  const observations: ObservationSet = {
    conditionKey: guide.conditionKey,
    items: Object.fromEntries(
      (journey.attempt?.observations || []).map((item) => [
        String(item.value),
        item,
      ]),
    ),
  };
  const nextObservation = guide.steps.find(
    (step) => !observations.items[String(step.value)],
  );
  const jumpToTransfer = () =>
    document.getElementById("transfer-title")?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  const currentCondition =
    guide.control === "degree"
      ? `${params.degree}阶模型`
      : guide.control === "samples"
        ? `${params.samples}个样本`
        : `α ${alphaLabel(params.alpha)}`;
  function setView(next: View) {
    onSectionChange(next);
    if(["concepts","classification","studio"].includes(next))setViewState(next);
    requestAnimationFrame(()=>document.getElementById("mechanism-content")?.focus());
  }
  function launchIsland(attempt:IslandAttempt){
    setIslandLaunch({attempt,serial:Date.now()});
    if(attempt.panel==="forest"){setClassLaunch(null);setView("classification");}
    else{setConceptLaunch(attempt.panel);setView("concepts");}
  }
  async function openWorkspaceEntry(entry:WorkspaceEntry,practice=false){
    if(entry.kind==="course"){if(await journey.resume(entry.id,practice))setView("studio");}
    else if(entry.kind==="island")launchIsland(await api<IslandAttempt>(`/islands/attempts/${entry.id}${practice?"/practice":""}`,practice?{}:undefined));
    else if(entry.kind==="saved"){const archive=await api<SavedRecord[]>("/records");const saved=archive.find(r=>String(r.id)===entry.id);if(saved){journey.reset(saved.result.parameters.scene);setParams({...saved.result.parameters});setView("studio");setChartTab("fit");setToast("已载入历史实验条件，原记录保持。");}}
  }
  async function openNextLesson(panel:IslandId|"history"){
    if(panel==="history"){setView("history");return;}
    launchIsland(await api<IslandAttempt>("/islands/tasks",{panel,mode:"discovery"}));
  }
  useEffect(()=>{const changed=()=>setWorkspaceRevision(n=>n+1);window.addEventListener("fitlab-workspace-changed",changed);return()=>window.removeEventListener("fitlab-workspace-changed",changed);},[]);
  useEffect(()=>{
    const abort=new AbortController();
    api<Health>("/health",undefined,abort.signal).then(value=>{setHealth(value);setServiceError("");}).catch(e=>{if(e.name!=="AbortError"){setHealth(null);setServiceError(e.message);}});
    api<WorkspaceOverview>("/workspace/overview",undefined,abort.signal).then(value=>{setWorkspaceError("");setCompleted(value.completed_scenes);localStorage.setItem("fitlab-learning-completed-v1",JSON.stringify(value.completed_scenes));}).catch(e=>{if(e.name!=="AbortError")setWorkspaceError(e.message);});
    return()=>abort.abort();
  },[view,workspaceRevision]);
  useEffect(() => {
    const stored = localStorage.getItem("fitlab-current-scene-v1");
    const previous = scenes.find((item) => item.id === stored);
    if (previous) setParams({ ...previous.defaults });
    setSceneReady(true);
  }, []);
  useEffect(()=>{setViewState(section);},[section]);
  useEffect(()=>{if(topicRequest){setViewState("concepts");setConceptLaunch(topicRequest.panel);}},[topicRequest?.serial]);
  const resumedSerial=useRef<number|null>(null);
  useEffect(()=>{if(sceneReady&&resumeRequest&&resumedSerial.current!==resumeRequest.serial){resumedSerial.current=resumeRequest.serial;void openWorkspaceEntry(resumeRequest.entry);}},[sceneReady,resumeRequest?.serial]);
  useEffect(() => {
    if (journey.attempt?.stage !== "complete") return;
    setCompleted((previous) => {
      const next = Array.from(
        new Set([...previous, journey.attempt!.parameters.scene]),
      );
      localStorage.setItem(
        "fitlab-learning-completed-v1",
        JSON.stringify(next),
      );
      return next;
    });
  }, [journey.attempt?.completed_at]);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("fitlab-learning-completed-v1") || "[]",
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
    if (!canReveal || view !== "studio") {
      setResult(null);
      setBusy(false);
      return () => controller.abort();
    }
    const timeout = setTimeout(
      () =>
        journey
          .observe(params, controller.signal)
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
  }, [params, retry, journey.activeId, journey.ready, view]);
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
    localStorage.setItem("fitlab-current-scene-v1", id);
    setParams({ ...scenes.find((s) => s.id === id)!.defaults });
    setChartTab("fit");
    if(view!=="studio")setView("studio");
  }
  function update<K extends keyof Parameters>(key: K, value: Parameters[K]) {
    setParams((p) => ({ ...p, [key]: value }));
  }
  function selectGuidedValue(value: number) {
    update(guide.control, value);
    if (window.matchMedia("(max-width: 760px)").matches) {
      document.getElementById("experiment-chart")?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
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
        title: title.trim() || `${scene.short} · ${currentCondition}`,
        note,
        prediction: journey.attempt?.prediction.label || "",
      });
      setModal(null);
      setToast("实验已保存，可在“我的学习记录”中回看。");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
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
          record_ids: [],
          learning_progress: completed,
          learning_attempt_id: journey.activeId,
          action_plan_ids: actionIds,
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
    <div className="pp-mechanism-host" data-scene={params.scene}>
      <div className="pp-embedded-shell">
        <div className="pp-embedded-content" id="mechanism-content" tabIndex={-1}>
          {serviceError&&<div className="workspace-service-error" role="alert"><p>{serviceError}</p><button className="text-button" onClick={()=>setWorkspaceRevision(n=>n+1)}>重新连接</button><button className="text-button" onClick={()=>setView("settings")}>检查设置</button></div>}
          {view === "concepts" && (
            <ConceptWorkshop
              learningLaunch={islandLaunch}
              onLearningConsumed={()=>setIslandLaunch(null)}
              onNextLesson={openNextLesson}
              onLearn={changeScene}
              launch={conceptLaunch}
              onLaunchConsumed={() => setConceptLaunch(null)}
            />
          )}
          {view === "classification" && (
            <ClassificationLab
              learningLaunch={islandLaunch}
              onLearningConsumed={()=>setIslandLaunch(null)}
              onNextLesson={openNextLesson}
              launch={classLaunch}
              onLaunchConsumed={() => setClassLaunch(null)}
            />
          )}
          {view === "studio" && (
            <>
              <div
                className={`studio-intro ${canReveal ? "is-experiment" : ""}`}
              >
                <div className="page-heading pp-contrast-heading">
                  <div>
                    <h1>
                      {scene.title}
                    </h1>
                    <p>{scene.description}</p>
                  </div>
                  <PlanetPortal variant={params.scene==='complexity'?'sensitivity':params.scene==='samples'?'error':'regularization'} className="pp-contrast-planet" priority sizes="(max-width:650px) 80px, 140px"/>
                  <div className="heading-actions">
                    <button
                      className="button secondary"
                      disabled={!result || busy}
                      onClick={() => {
                        setTitle(`${scene.short} · ${currentCondition}`);
                        setNote("");
                        setModal("save");
                      }}
                    >
                      <Save size={16} />
                      保存实验
                    </button>
                    <button
                      className="button secondary"
                      disabled={!result || busy}
                      onClick={() => setModal("report")}
                    >
                      <ArrowDownToLine size={16} />
                      导出报告
                    </button>
                  </div>
                </div>

                <fieldset className="pp-foundation-picker">
                  <legend>选择对照主题</legend>
                  <div>{scenes.map(s=><label key={s.id}><input type="radio" name="foundation-scene" value={s.id} checked={params.scene===s.id} onChange={()=>changeScene(s.id)}/><span><strong>{s.short}</strong></span></label>)}</div>
                </fieldset>
                <JourneySteps attempt={journey.attempt} />
              </div>
              {journey.error && (
                <div className="error-banner" role="alert">
                  {journey.error}
                </div>
              )}
              {!canReveal ? (
                <PredictionGate
                  key={guide.conditionKey}
                  guide={guide}
                  parameters={params}
                  ready={journey.ready}
                  working={journey.working}
                  onSubmit={journey.begin}
                />
              ) : (
                <>
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
                      tag="MSE"
                      value={
                        result && !busy ? metric(result.metrics.train_mse) : "—"
                      }
                      color="teal"
                      caption={`${params.samples} 个样本，用于拟合`}
                    />
                    <MetricCard
                      icon={<Activity size={16} />}
                      label="验证误差"
                      tag="MSE"
                      value={
                        result && !busy
                          ? metric(result.metrics.validation_mse)
                          : "—"
                      }
                      color="coral"
                      caption="80 个样本，用于比较参数"
                    />
                    <MetricCard
                      icon={<Layers3 size={16} />}
                      label="泛化差距"
                      tag="MSE"
                      value={result && !busy ? metric(result.metrics.gap) : "—"}
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
                        {!busy && result
                          ? result.diagnosis.label
                          : "正在计算实验"}
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

                  <MetricHelp />
                  <div className="workspace-grid">
                    <section
                      className="panel chart-panel"
                      id="experiment-chart"
                      aria-busy={busy}
                    >
                      <div className="panel-heading">
                        <div>
                          <h2>
                            <span className="panel-dot" />
                            看见模型如何拟合
                          </h2>
                          <p>{guide.prompt}</p>
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
                        <LearningMission
                          guide={guide}
                          params={params}
                          observations={observations}
                          onSelect={selectGuidedValue}
                        />
                        <span className="chart-hint">
                          {chartTab === "fit"
                            ? "悬停探索数据点"
                            : "同一数据 · 比较 1—15 阶"}
                        </span>
                      </div>
                      {chartTab === "fit" ? (
                        <FitChart result={result} />
                      ) : (
                        <div className="sweep-container">
                          {sweep ? (
                            <>
                              <ErrorChart
                                data={sweep}
                                current={params.degree}
                              />
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
                          <ShieldCheck size={14} />
                          {busy && result
                            ? "正在更新，图形暂为上次结果"
                            : "数据条件固定，适合逐项比较"}
                        </span>
                        <span>合成数据 · 随机种子 {params.seed}</span>
                      </div>
                    </section>

                    <ExperimentControls
                      params={params}
                      onChange={(key, value) =>
                        setParams((previous) => ({ ...previous, [key]: value }))
                      }
                      onReset={() => setParams({ ...scene.defaults })}
                    />
                  </div>
                  <div className="experiment-next">
                    <span className="observation-count">
                      {journey.attempt!.observations.length}
                      <small>/3</small>
                    </span>
                    <div>
                      <strong>
                        {nextObservation
                          ? `下一步观察：${nextObservation.label}`
                          : "三次对照已齐，换一批数据检验理解"}
                      </strong>
                      <p>
                        {nextObservation
                          ? "保留其他条件，看看这次验证误差怎样变化。"
                          : "把实际结果与你的预测放在一起，再完成迁移判断。"}
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() =>
                        nextObservation
                          ? selectGuidedValue(nextObservation.value)
                          : jumpToTransfer()
                      }
                    >
                      {nextObservation ? "观察下一组" : "进入迁移验证"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <ObservationBoard
                    guide={guide}
                    observations={observations}
                    onSelect={selectGuidedValue}
                  />
                  <PredictionReview
                    attempt={journey.attempt!}
                    onReset={() => journey.reset()}
                  />

                  <div className="learning-grid">
                    <TransferValidation
                      key={journey.attempt!.task?.id || journey.activeId}
                      attempt={journey.attempt!}
                      working={journey.working}
                      onSubmit={journey.transfer}
                      onRetry={journey.retryTransfer}
                      onRealData={() => setView("datasets")}
                    />

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
                            ? "AI讲解"
                            : coach?.mode === "rules"
                              ? "规则讲解"
                              : "依据本次计算"}
                        </span>
                      </div>
                      {coach ? (
                        <div className="coach-response">
                          <div className="coach-response-text">
                            {coach.content}
                          </div>
                          {coach.notice && (
                            <p className="coach-notice">{coach.notice}</p>
                          )}
                          <div className="evidence-anchor">
                            <ShieldCheck size={12} />
                            依据当前实验 ·{" "}
                            {result?.data_fingerprint.slice(0, 8)}
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
                            {coaching ? "正在分析实验…" : "解释这次实验"}
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      )}
                      <ActionExperiment
                        kind="synthetic"
                        learningAttemptId={journey.activeId || undefined}
                        parameters={params}
                        enabled={!busy && !!result}
                        onApply={(value) => setParams(value as Parameters)}
                        onVerified={(id) =>
                          setActionIds((previous) =>
                            Array.from(new Set([...previous, id])).slice(-12),
                          )
                        }
                      />
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
                          disabled={
                            busy || !result || coaching || !question.trim()
                          }
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
                            : "120 个独立测试样本暂不参与参数选择。完成迁移验证并选好模型后，再做一次最终评估。"}
                        </p>
                      </div>
                    </div>
                    <button
                      className="button secondary"
                      disabled={
                        busy ||
                        !result ||
                        !!final ||
                        journey.attempt?.stage !== "complete"
                      }
                      onClick={() => setModal("final")}
                    >
                      {final ? (
                        <CheckCheck size={15} />
                      ) : (
                        <ShieldCheck size={15} />
                      )}{" "}
                      {final
                        ? "已完成评估"
                        : journey.attempt?.stage !== "complete"
                          ? "迁移验证后开放"
                          : "最终评估"}
                    </button>
                  </section>
                </>
              )}
            </>
          )}

        </div>
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
                  {saving ? "正在保存…" : "保存实验记录"}
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
                  报告包含参数、真实指标、数据指纹、本轮预测与迁移作答及AI核验。
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
                  对照实验使用合成数据，分类与回归任务使用内置公开快照；图表与指标由Python计算，解释基于同一份证据。
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
                    葡萄酒质量 · UCI Wine Quality
                    <ArrowUpRight size={15} />
                  </a>
                  <a
                    href="https://archive.ics.uci.edu/dataset/9/auto+mpg"
                    target="_blank"
                    rel="noreferrer"
                  >
                    汽车油耗 · UCI Auto MPG
                    <ArrowUpRight size={15} />
                  </a>
                  <a
                    href="https://archive.ics.uci.edu/dataset/165/concrete+compressive+strength"
                    target="_blank"
                    rel="noreferrer"
                  >
                    混凝土强度 · UCI Concrete Strength
                    <ArrowUpRight size={15} />
                  </a>
                  <a
                    href="https://archive.ics.uci.edu/dataset/53/iris"
                    target="_blank"
                    rel="noreferrer"
                  >
                    鸢尾花 · UCI Iris
                    <ArrowUpRight size={15} />
                  </a>
                  <a
                    href="https://archive.ics.uci.edu/dataset/236/seeds"
                    target="_blank"
                    rel="noreferrer"
                  >
                    小麦籽粒 · UCI Seeds
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
