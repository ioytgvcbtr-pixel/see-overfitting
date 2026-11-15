"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, Compass, Eye, FlaskConical, History, Lightbulb, LoaderCircle, RotateCcw, Sparkles, Target } from "lucide-react";
import { api } from "@/lib/experiment";
import { inputKey, islandNames, learningReference, proofNumber, type IslandAttempt, type IslandId,
  type IslandInput, type IslandPlan, type IslandProof } from "@/lib/island-learning";
import LearningCompanion from "./LearningCompanion";
import HelpHint from "./HelpHint";

type Props = {
  panel: IslandId; input: IslandInput; pending: boolean;
  onApply: (value: IslandInput, selected?: number, fitCurrent?: boolean) => void;
  onLocate: (focus: string) => void;
};
const storageKey = (panel: IslandId) => `fitlab-island-learning-v13-${panel}`;

function Evidence({ proof, panel }: { proof: IslandProof; panel: IslandId }) {
  return <div className="island-learning-proof">
    <span>{proof.metric}</span>
    <div className="island-learning-values"><strong>{proofNumber(proof.before, panel)}</strong>
      {panel === "sensitivity" ? <span aria-hidden="true">/</span> : <ArrowRight size={20} aria-hidden="true" />}<strong>{proofNumber(proof.after, panel)}</strong></div>
    {proof.before_norm !== undefined && <p>系数范数 {proofNumber(proof.before_norm, "regularization")} → {proofNumber(proof.after_norm!, "regularization")}</p>}
    {proof.before_train !== undefined && <p>训练{panel === "forest" ? "准确率" : "MSE"} {proofNumber(proof.before_train, panel)} → {proofNumber(proof.after_train!, panel)}</p>}
    {proof.before_mistakes !== undefined && <p>验证错分 {proof.before_mistakes} → {proof.after_mistakes}；固定样本{proof.fixed ? "已纠正" : "未纠正"}</p>}
    {proof.a_validation !== undefined && <p>验证MSE（A / B） {proofNumber(proof.a_validation, "sensitivity")} / {proofNumber(proof.b_validation!, "sensitivity")}</p>}
  </div>;
}

export default function IslandJourney({ panel, input, pending, onApply, onLocate }: Props) {
  const [attempt, setAttempt] = useState<IslandAttempt | null>(null);
  const [saved, setSaved] = useState<IslandAttempt | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<number | null>(null), [confidence, setConfidence] = useState(2);
  const [reason, setReason] = useState(""), [transferChoice, setTransferChoice] = useState<number | null>(null);
  const [transferReason, setTransferReason] = useState<number | null>(null);
  const [plan, setPlan] = useState<IslandPlan | null>(null);
  const [actionHistory, setActionHistory] = useState<IslandPlan[]>([]);
  const [history, setHistory] = useState<IslandAttempt[]>([]);
  const [motion, setMotion] = useState(0);
  const [intro, setIntro] = useState(false);
  const operation = useRef(0), controller = useRef<AbortController | null>(null);
  const currentInput = useRef(input);
  currentInput.current = input;
  useEffect(() => {
    const abort = new AbortController();
    try {
      setIntro(localStorage.getItem("fitlab-island-intro-v13") !== "seen");
      const id = learningReference(localStorage.getItem(storageKey(panel)));
      if (id) api<IslandAttempt>(`/islands/attempts/${id}`, undefined, abort.signal)
        .then(setSaved).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    } catch { setError("浏览器无法保存续接入口，本轮仍可学习。"); }
    return () => { abort.abort(); controller.current?.abort(); operation.current++; };
  }, [panel]);

  function remember(value: IslandAttempt) {
    setAttempt(value);
    try { localStorage.setItem(storageKey(panel), value.id); } catch { setError("学习记录已在本机服务保存，浏览器续接入口未能保存。"); }
  }
  async function run<T>(label: string, url: string, body: object | undefined, accept: (value: T) => void) {
    controller.current?.abort();
    const abort = new AbortController(), ticket = ++operation.current;
    controller.current = abort; setBusy(label); setError("");
    try {
      const value = await api<T>(url, body, abort.signal);
      if (ticket === operation.current && !abort.signal.aborted) accept(value);
    } catch (e) { if (ticket === operation.current && (e as Error).name !== "AbortError") setError((e as Error).message); }
    finally { if (ticket === operation.current) setBusy(null); }
  }
  const active = attempt, task = active?.task;
  const atTarget = !!task && inputKey(input) === inputKey(task.target_parameters);
  const planMatches = !!plan && inputKey(input) === inputKey(plan.baseline_parameters);
  const transfer = active?.transfer_task;
  const isLocked = !!busy;
  function apply(value: IslandInput, selected?: number, fitCurrent = false) { onApply(value, selected, fitCurrent); }
  function start(mode: "discovery" | "counterexample") {
    setChoice(null); setTransferChoice(null); setTransferReason(null); setReason(""); setPlan(null); setActionHistory([]); setMotion(0);
    void run<IslandAttempt>("准备挑战", "/islands/tasks", { panel, mode, avoid_seed: input.seed }, remember);
  }
  function predict() {
    if (!active || choice === null) return;
    void run<IslandAttempt>("保存预测", `/islands/attempts/${active.id}/predict`, { choice, confidence, reason }, value => {
      remember(value); apply(value.task.before_parameters, value.task.row ?? value.task.selected, true);
      setIntro(false); try { localStorage.setItem("fitlab-island-intro-v13", "seen"); } catch { /* preference only */ }
    });
  }
  function restore(value: IslandAttempt) {
    remember(value); setSaved(null); setPlan(null); setActionHistory([]); setMotion(0);
    if (value.stage === "complete" && value.transfer_task) apply(value.transfer_task.target_parameters, value.transfer_task.row ?? value.transfer_task.selected, true);
    else if (value.stage === "experiment") apply(value.task.before_parameters, value.task.row ?? value.task.selected, true);
    else if (value.observation) apply(value.task.target_parameters, value.task.row ?? value.task.selected, true);
  }
  const stage = active?.stage;
  return <section className="island-learning" aria-label={`${islandNames[panel]}学习挑战`} aria-busy={!!busy}>
    <header className="island-learning-heading"><span className="learning-emblem"><Compass size={24} /></span>
      <h3>{active?.task.title ?? "带着一个猜想出发"}</h3>
      <HelpHint title="这次怎样学"><p>先留下预测，再动手实验，最后换一组数据验证。首次判断保留，提示和AI辅助另作标记；四岛记录与原课程成绩分开。</p></HelpHint>
    </header>
    {stage && <ol className="island-learning-steps" aria-label="学习阶段">{["预测", "实验", "迁移"].map((label, i) => {
      const current = stage === "predict" ? 0 : stage === "experiment" || stage === "review" ? 1 : 2;
      return <li key={label} aria-current={i === current ? "step" : undefined} data-done={i < current || stage === "complete"}><span>{i < current || stage === "complete" ? <Check size={18} /> : i+1}</span>{label}</li>;
    })}</ol>}
    {error && <p className="island-learning-error" role="alert">{error}</p>}
    {busy && <p className="island-learning-busy" role="status"><LoaderCircle size={20} className="spin" />{busy}…</p>}

    {!active && <>
      {intro && <div className="island-first-step"><BookOpen size={24} /><p>先猜一次，亲手试试，再去新数据里检验。</p>
        <button className="text-button" onClick={() => { setIntro(false); try { localStorage.setItem("fitlab-island-intro-v13", "seen"); } catch {} }}>知道了，收起引导</button></div>}
      {saved && <div className="island-resume-line"><p>{saved.stage === "complete" ? "上次的发现可以回看" : "上次的学习还在"}</p>
        <button className="button secondary" disabled={isLocked} onClick={() => restore(saved)}><History size={20} />{saved.stage === "complete" ? "回看发现" : "继续学习"}</button></div>}
      <p className="island-learning-lead">{({error:"训练拟合得更好，新数据也会更好吗？", sensitivity:"一枚路钉，会更牵动哪条路？", regularization:"枝条收起来，远处就更准吗？", forest:"救回一件包裹，整体就更好吗？"})[panel]}</p>
      <div className="island-start-options"><button className="button primary" disabled={isLocked} onClick={() => start("discovery")}><FlaskConical size={20} />开始一次发现</button>
        <button className="button secondary" disabled={isLocked} onClick={() => start("counterexample")}><Lightbulb size={20} />挑战一个反例</button></div>
    </>}

    {active && task && stage === "predict" && <>
      <p className="island-operation">{task.operation}</p>
      <p className="island-condition">{task.context}；seed {task.seed}。预测后载入画布。</p>
      <fieldset disabled={isLocked}><legend>{task.question}</legend>
        <div className="island-answer-options">{task.choices.map((label, i) => <button key={label} aria-pressed={choice === i} onClick={() => setChoice(i)}>{label}</button>)}</div>
      </fieldset>
      <fieldset className="island-confidence" disabled={isLocked}><legend>你有多确定？</legend><div>{["试着猜", "有些把握", "很确定"].map((label, i) => <button key={label} aria-pressed={confidence === i+1} onClick={() => setConfidence(i+1)}>{label}</button>)}</div></fieldset>
      <details className="island-optional-reason"><summary>写下理由（可选）</summary><label><span className="sr-only">预测理由</span><textarea maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="我猜……因为……" /></label></details>
      <button className="button primary" disabled={isLocked || choice === null} onClick={predict}>锁定预测，开始实验<ArrowRight size={20} /></button>
    </>}

    {active && task && stage === "experiment" && <>
      <LearningCompanion mood="welcome" title="让物件回答你的猜想" message={task.operation} event={0} />
      <p className="island-prediction-line">你的预测：{task.choices[active.prediction!.choice]}</p>
      <div className="island-action-pair"><button className="button secondary" disabled={isLocked} onClick={() => onLocate(task.focus)}><Target size={20} />定位证据</button>
        <button className="button secondary" disabled={isLocked} onClick={() => apply(task.before_parameters, task.row ?? task.selected)}><RotateCcw size={20} />回到起点</button></div>
      <p className="island-condition">{pending ? "等待当前实算。" : atTarget ? "目标条件已就绪，可以核验。" : "保持其他条件不变，使用场景控件完成上方操作。"}</p>
      <button className="button primary" disabled={isLocked || pending || !atTarget} onClick={() => void run<IslandAttempt>("核验实验", `/islands/attempts/${active.id}/observe`, {parameters:input}, v => { remember(v); setMotion(n => n+1); onLocate(task.focus); })}>核验这次实验<Check size={20} /></button>
      <button className="text-button" disabled={isLocked || active.hints_used >= 2} onClick={() => void run<IslandAttempt>("记录提示", `/islands/attempts/${active.id}/hint`, {}, v => { remember(v); onLocate(task.focus); })}><Lightbulb size={20} />{active.hints_used ? "再看一步" : "给我一个提示"}</button>
      {active.hints_used > 0 && <div className="island-hint" role="status"><p>{active.hints_used === 1 ? panel === "sensitivity" ? "RMS衡量两路被牵动的幅度，验证MSE衡量预测误差。先找到题目问的那一组读数。" : panel === "regularization" ? "可放大当前枝条，再分别核对系数范数和验证MSE；调α时保持其他条件不变。" : panel === "forest" ? "固定这件包裹，切换模型后也要核对全体验证准确率。" : "训练MSE和验证MSE衡量不同数据上的拟合；保持验证数据不变，分别比较。" : `只完成这一项：${task.operation}。需要时点“回到起点”，重新调整。`}</p>
        {active.hints_used === 2 && !atTarget && <button className="button secondary" disabled={isLocked} onClick={() => apply(task.target_parameters, task.row ?? task.selected)}>按提示设置目标</button>}</div>}
    </>}

    {active && task && stage === "review" && active.observation && <>
      <LearningCompanion mood={active.observation.matched ? "celebrate" : "thinking"} title={active.observation.matched ? "这次结果与你的预测一致" : "发现了一个值得修正的猜想"} message="一次划分的结果，需要继续用新数据检验。" event={motion} />
      <p className="island-prediction-line">最初预测：{task.choices[active.prediction!.choice]}；实际：{task.choices[active.observation.choice]}（seed {task.seed}）</p>
      <Evidence panel={panel} proof={active.observation} />
      <p className="island-insight">{active.observation.conclusion}</p>
      <button className="button primary" disabled={isLocked} onClick={() => { setPlan(null); void run<IslandAttempt>("准备新数据", `/islands/attempts/${active.id}/transfer-task`, {}, remember); }}>去新数据里验证<ArrowRight size={20} /></button>
    </>}

    {active && transfer && stage === "transfer" && <>
      <p className="island-transfer-intro"><Target size={24} />换一组数据，独立判断</p>
      <p className="island-condition">{transfer.context}；seed {task!.seed} → {transfer.seed}。本题结果在作答后揭示。</p>
      <p className="island-operation">{transfer.operation}</p>
      <fieldset disabled={isLocked}><legend>{transfer.question}</legend><div className="island-answer-options">{transfer.choices.map((label, i) => <button key={label} aria-pressed={transferChoice === i} onClick={() => setTransferChoice(i)}>{label}</button>)}</div></fieldset>
      <fieldset disabled={isLocked}><legend>哪条依据更可靠？</legend><div className="island-reason-options">{transfer.reasons.map((label, i) => <button key={label} aria-pressed={transferReason === i} onClick={() => setTransferReason(i)}>{label}</button>)}</div></fieldset>
      <button className="button primary" disabled={isLocked || transferChoice === null || transferReason === null} onClick={() => void run<IslandAttempt>("核验迁移", `/islands/attempts/${active.id}/answer`, {task_id:transfer.id,choice:transferChoice,reason:transferReason}, v => {
        remember(v); setMotion(n => n+1);
        if (v.transfer_task) apply(v.transfer_task.target_parameters, v.transfer_task.row ?? v.transfer_task.selected, true);
      })}>提交判断与依据<Check size={20} /></button>
    </>}

    {active && transfer && stage === "complete" && active.transfer_answer && <>
      <LearningCompanion mood={active.transfer_answer.passed ? "celebrate" : "thinking"} title={active.transfer_answer.passed ? "判断与依据都通过核验" : "这次迁移还需要再练习"} message={active.transfer_answer.assisted ? "本轮使用过提示或AI辅助，记录已标明。" : "本轮未使用提示或AI辅助。"} event={motion} />
      <p className="island-prediction-line">首次迁移：{transfer.choices[active.transfer_answer.choice]}；实际：{transfer.choices[active.transfer_answer.proof.choice]}（seed {transfer.seed}）</p>
      <Evidence panel={panel} proof={active.transfer_answer.proof} />
      <p className="island-insight">{transfer.reasons[active.transfer_answer.correct_reason]}</p>
      {active.observation && <details className="island-round-review"><summary><BookOpen size={20} />回看这轮预测与实验</summary>
        <p>最初预测：{task!.choices[active.prediction!.choice]}；实际：{task!.choices[active.observation.choice]}（seed {task!.seed}）</p>
        <p>当时信心：{["试着猜", "有些把握", "很确定"][active.prediction!.confidence-1]}{active.prediction!.reason ? `；理由：${active.prediction!.reason}` : ""}</p>
        <Evidence panel={panel} proof={active.observation} />
        <p>{active.observation.conclusion}</p><p className="island-condition">实验提示 {active.hints_used}级；迁移前AI实验 {active.ai_before_transfer.length}次。</p>
        <button className="text-button" disabled={isLocked} onClick={() => { apply(task!.target_parameters, task!.row ?? task!.selected, true); onLocate(task!.focus); }}><RotateCcw size={20} />复现实验场景</button>
      </details>}
      <div className="island-action-pair"><button className="button secondary" disabled={isLocked} onClick={() => { apply(transfer.target_parameters, transfer.row ?? transfer.selected); onLocate(transfer.focus); }}><Eye size={20} />查看场景</button>
        <button className="button secondary" disabled={isLocked} onClick={() => start(active.mode)}><RotateCcw size={20} />新建练习</button></div>
    </>}

    {active && (stage === "review" || stage === "complete") && <details className="island-ai-tool" onToggle={e => {
      if (e.currentTarget.open) void api<IslandPlan[]>(`/islands/actions?attempt_id=${active.id}`).then(rows => {
        setActionHistory(rows); if (!plan && rows.length) setPlan(rows[0]);
      }).catch(e => setError(e.message));
    }}><summary><Sparkles size={20} />再做一个AI实验</summary>
      <p>用当前画布条件生成单变量方案，执行后核验真实验证表现。</p>
      <button className="button secondary" disabled={isLocked || pending} onClick={() => void run<IslandPlan>("AI正在构思实验", "/islands/actions/plan", {panel,parameters:input,attempt_id:active.id}, setPlan)}>{plan ? "重新生成方案" : "生成可执行方案"}</button>
      {plan && <div className="island-ai-preview"><p className="island-condition">{plan.mode === "online" ? `${plan.model} · AI方案` : "规则方案"}</p>{plan.notice && <p role="status">{plan.notice}</p>}
        <strong>{plan.change.label}：{String(plan.change.from_value)} → {String(plan.change.to_value)}</strong><p>{plan.hypothesis}</p>
        <p>待检验预期：{plan.expected === "lower" ? "验证误差降低" : plan.expected === "higher" ? "验证误差升高" : "只观察，不预设方向"}</p>
        {!plan.execution ? <button className="button primary" disabled={isLocked || pending || !planMatches} onClick={() => void run<IslandPlan>("执行并复算", `/islands/actions/${plan.id}/execute`, {parameters:input}, v => {
          setPlan(v);
          setActionHistory(rows => [v,...rows.filter(row => row.id !== v.id)]);
          if (inputKey(currentInput.current) === inputKey(v.baseline_parameters)) apply(v.target_parameters);
          else setError("实验已核验并保存；画布已被你调整，保留当前条件。");
          if (!active.transfer_answer) remember({...active,ai_before_transfer:[...new Set([...active.ai_before_transfer,v.id])]});
        })}>执行这项操作<FlaskConical size={20} /></button> : <div className="island-ai-result" role="status"><strong>{({supported:"这次结果支持预期",not_supported:"这次结果不支持预期",observed:"已记录实际变化"})[plan.execution.verdict]}</strong><p>{plan.execution.metric} {proofNumber(plan.execution.before, panel === "forest" ? "forest" : "error")} → {proofNumber(plan.execution.after, panel === "forest" ? "forest" : "error")}</p>
          <button className="text-button" disabled={isLocked} onClick={() => apply(plan.baseline_parameters)}><RotateCcw size={20} />恢复执行前条件</button></div>}
        {!planMatches && !plan.execution && <p role="status">画布条件已变化，请重新生成方案。</p>}</div>}
      {actionHistory.filter(row => row.execution && row.id !== plan?.id).length > 0 && <div className="island-ai-past"><p>已核验的实验</p>{actionHistory.filter(row => row.execution && row.id !== plan?.id).slice(0,3).map(row => <button className="text-button" disabled={isLocked} key={row.id} onClick={() => setPlan(row)}>{row.change.label} {String(row.change.to_value)} · 回看</button>)}</div>}
    </details>}

    <details className="island-learning-history" onToggle={e => { if (e.currentTarget.open) void api<IslandAttempt[]>("/islands/history").then(rows => setHistory(rows.filter(r => r.panel === panel))).catch(e => setError(e.message)); }}><summary><History size={20} />本岛学习记录</summary>
      {history.length === 0 ? <p>留下首次预测后，学习过程会保存在这里。</p> : <ul>{history.slice(0, 8).map(row => <li key={row.id}><div><strong>{row.mode === "counterexample" ? "反例挑战" : "一次发现"}</strong><span>{row.stage === "complete" ? row.transfer_answer?.passed ? "迁移通过" : "迁移需重练" : "进行中"}{row.hints_used || row.ai_before_transfer.length ? " · 有辅助" : ""}</span></div><button className="text-button" disabled={isLocked} onClick={() => void run<IslandAttempt>("载入学习", `/islands/attempts/${row.id}`, undefined, restore)}>回看</button></li>)}</ul>}
    </details>
    {active && <button className="text-button island-learning-pause" disabled={isLocked} onClick={() => { setSaved(active); setAttempt(null); setPlan(null); }}>暂存学习，继续探索</button>}
  </section>;
}
