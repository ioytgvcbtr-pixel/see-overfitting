"use client";
import { useEffect, useState, useRef, type PointerEvent } from "react";
import { ArrowRight, Copy, Check, RotateCcw } from "lucide-react";
import {
  classColors,
  classModels,
  classPercent,
  classC,
  classGamma,
  type ClassInput,
  type ClassResult,
  type ClassModel,
} from "@/lib/classification";
import { deliveryGate } from "@/lib/island-experiments";
import { useChartWidth } from "./useChartWidth";
import { LittleTree, SceneRange } from "./IslandControls";
import ParcelMap from "./ParcelMap";
import HelpHint from "./HelpHint";
import { useForestChallenge } from "./useForestChallenge";
import IslandJourney from "./IslandJourney";
import CausalTrace from "./CausalTrace";
import LearningCompanion from "./LearningCompanion";
import LayeredHint from "./LayeredHint";
import { pauseProgress, type ForestDraft } from "@/lib/island-progress";
import { BookmarkCheck } from "lucide-react";
import { Slash, UsersRound, Orbit, GitBranch, Trees } from "lucide-react";

function ModelGlyph({ id }: { id: ClassModel }) {
  const Icon = {
    logistic: Slash,
    knn: UsersRound,
    svm: Orbit,
    tree: GitBranch,
    forest: Trees,
  }[id];
  return <Icon size={20} aria-hidden="true" />;
}

export default function ForestDelivery({
  input,
  result,
  selected,
  pending,
  onInput,
  onSelect,
  onRescue,
  resume,
  onResumeConsumed,
  onResumeRequest,
}: {
  input: ClassInput;
  result: ClassResult;
  selected: number | null;
  pending: boolean;
  onInput: (p: ClassInput) => void;
  onSelect: (row: number) => void;
  onRescue: () => void;
  resume: ForestDraft | null;
  onResumeConsumed: () => void;
  onResumeRequest: (d: ForestDraft) => void;
}) {
  const { ref, width } = useChartWidth(),
    active = useRef<number | null>(null);
  const progress = useForestChallenge(
    input,
    result,
    selected,
    pending,
    onInput,
    onSelect,
    onRescue,
    resume,
    onResumeConsumed,
  );
  const { point, key, current, rescued, rescue } = progress;
  const matched = progress.matched && !progress.restoring;
  const [hint, setHint] = useState(""),
    [copied, setCopied] = useState(false);
  const [parcel, setParcel] = useState<{ x: number; y: number } | null>(null),
    [focusGate, setFocusGate] = useState(0);
  const stageRef = useRef<HTMLElement>(null),
    [spotlight, setSpotlight] = useState<string | null>(null);
  useEffect(() => {
    setCopied(false);
    setHint("");
    setSpotlight(null);
  }, [key]);
  const gates = result.dataset.classes,
    gx = (i: number) => ((i + 0.5) / gates.length) * width;
  const canReveal =
    !!current && (current.gate === point.prediction || progress.hintLevel >= 2);
  const showModelRoute = canReveal || !!rescued;
  const px =
      parcel?.x ??
      (showModelRoute
        ? gx(point.prediction)
        : current
          ? gx(current.gate)
          : width * 0.5),
    py = parcel?.y ?? (current || showModelRoute ? 252 : 65);
  function choose(row: number) {
    progress.choose(row);
    setHint("");
    setCopied(false);
  }
  function deliver(gate: number) {
    if (!matched) return;
    progress.deliver(gate);
    setHint("");
    setCopied(false);
  }
  function coordinates(e: PointerEvent<SVGGElement>) {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(width, ((e.clientX - rect.left) / rect.width) * width),
      ),
      y: Math.max(
        0,
        Math.min(300, ((e.clientY - rect.top) / rect.height) * 300),
      ),
    };
  }
  const change = progress.change;
  function locate(target: "map" | "models") {
    setSpotlight(target);
    requestAnimationFrame(() => {
      const el = stageRef.current?.querySelector<HTMLElement>(
        target === "map" ? ".forest-sample-tag" : ".forest-model-choices",
      );
      el?.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      el?.focus({ preventScroll: true });
    });
  }
  async function copy() {
    if (!matched || (!canReveal && !rescued?.fixed)) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            kind: "forest-discovery",
            created_at: new Date().toISOString(),
            parameters: input,
            fingerprint: result.fingerprint,
            validation_fingerprint: result.validation_fingerprint,
            point: current
              ? point
              : result.validation.find((p) => p.row === rescue?.row),
            student_gate: current?.gate,
            rescue: rescued,
            validation_accuracy: result.metrics.validation_accuracy,
            formal_grade: false,
          },
          null,
          2,
        ),
      );
      setCopied(true);
    } catch {
      setHint("复制未成功，请使用页面的探索记录复制。");
    }
  }
  return (
    <section
      ref={stageRef}
      data-hint-focus={spotlight}
      className="island-workbench island-forest"
      aria-label="边界森林互动投递站"
    >
      <header className="island-stage-heading">
        <div>
          <h2>包裹会去哪道门？</h2>
        </div>
        <HelpHint title="怎样投递与救援">
          <p>
            先看样本特征和区域小地图，猜模型会把包裹投向哪类。把包裹拖到门前，或按门按钮、用左右键和Enter投递；再核对真实类别。
          </p>
          <p>
            包裹移动不修改验证数据。发现错分后可固定样本、只换模型或参数尝试救援，同时核对整体准确率。任务会在本浏览器保存，返回后按参数复算，不计正式成绩。
          </p>
        </HelpHint>
        <span
          className={`island-freshness ${matched ? "" : "pending"}`}
          role="status"
        >
          {matched ? "已实算" : "更新中 · 上次结果"}
        </span>
      </header>
      <div className="island-workbench-grid">
        <div className="island-scene-column">
          <div className="island-live-scene forest-scene" ref={ref}>
            <svg
              viewBox={`0 0 ${width} 300`}
              role="group"
              aria-label="将验证样本包裹拖到类别门，核对当前模型预测"
            >
              <path
                d={`M8 200Q${width * 0.25} 145 ${width * 0.5} 190T${width - 8} 175L${width - 8} 248Q${width * 0.5} 285 8 248Z`}
                fill="#dce7c8"
              />
              <path
                d={`M8 246Q${width * 0.5} 281 ${width - 8} 246v12Q${width * 0.5} 290 8 261Z`}
                fill="#bda888"
              />
              <LittleTree x={30} y={150} scale={0.8} />
              <LittleTree x={width - 32} y={130} scale={1} />
              <LittleTree x={width * 0.76} y={58} scale={0.5} />
              {showModelRoute && (
                <path
                  d={`M${width * 0.5} 86Q${width * 0.5} 135 ${gx(point.prediction)} 252`}
                  fill="none"
                  stroke={classColors[point.prediction]}
                  strokeWidth="4"
                  strokeDasharray="6 5"
                />
              )}
              {gates.map((name, i) => (
                <g
                  key={name}
                  role="button"
                  tabIndex={matched ? 0 : -1}
                  aria-label={`投递到${String.fromCharCode(65 + i)}门：${name}`}
                  aria-disabled={!matched}
                  onClick={() => deliver(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      deliver(i);
                    }
                  }}
                  className="forest-gate"
                >
                  <rect
                    x={gx(i) - 35}
                    y="120"
                    width="70"
                    height="91"
                    rx="30"
                    fill={
                      current && point.prediction === i ? "#faf7ee" : "#f4f3df"
                    }
                    stroke={classColors[i]}
                    strokeWidth={current && point.prediction === i ? 4 : 2}
                  />
                  <path
                    d={`M${gx(i) - 26} 195v-45q26-37 52 0v45`}
                    fill="none"
                    stroke="#c6b28c"
                    strokeWidth="7"
                  />
                  <text
                    x={gx(i)}
                    y="163"
                    textAnchor="middle"
                    fontSize="22"
                    fill={classColors[i]}
                    fontWeight="700"
                  >
                    {String.fromCharCode(65 + i)}
                  </text>
                  <path
                    d={`M${gx(i) - 38} 208h76`}
                    stroke="#bba77e"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  {current?.gate === i && (
                    <path
                      d={`M${gx(i) - 17} 106h34`}
                      stroke={
                        current.gate === point.prediction
                          ? "#087e75"
                          : "#b84b2c"
                      }
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  )}
                  <rect
                    className="gate-focus-ring"
                    x={gx(i) - 42}
                    y="111"
                    width="84"
                    height="100"
                    rx="34"
                    fill="none"
                    strokeWidth="3"
                  />
                </g>
              ))}
              <g
                role="button"
                tabIndex={matched ? 0 : -1}
                aria-label={`验证点${point.row + 1}包裹，左右键选择门，Enter投递`}
                aria-disabled={!matched}
                className="forest-parcel"
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    setFocusGate(
                      Math.max(
                        0,
                        Math.min(
                          gates.length - 1,
                          focusGate + (e.key === "ArrowRight" ? 1 : -1),
                        ),
                      ),
                    );
                    setHint(
                      `准备投向${String.fromCharCode(65 + Math.max(0, Math.min(gates.length - 1, focusGate + (e.key === "ArrowRight" ? 1 : -1))))}门，按Enter确认。`,
                    );
                  }
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    deliver(focusGate);
                  }
                }}
                onPointerDown={(e) => {
                  if (!matched) return;
                  e.preventDefault();
                  active.current = e.pointerId;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setParcel(coordinates(e));
                }}
                onPointerMove={(e) => {
                  if (active.current === e.pointerId) setParcel(coordinates(e));
                }}
                onPointerUp={(e) => {
                  if (active.current !== e.pointerId) return;
                  const pos = coordinates(e);
                  active.current = null;
                  setParcel(null);
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  if (pos.y >= 115)
                    deliver(deliveryGate(pos.x, width, gates.length));
                  else setHint("把包裹拖到类别门前，或使用下方投递按钮。");
                }}
                onPointerCancel={() => {
                  active.current = null;
                  setParcel(null);
                }}
                onLostPointerCapture={() => {
                  active.current = null;
                  setParcel(null);
                }}
              >
                <circle cx={px} cy={py} r="29" fill="transparent" />
                <ellipse cx={px} cy={py + 23} rx="25" ry="6" fill="#786a5524" />
                <path
                  d={`M${px - 20} ${py - 15}l20-9 20 9v31l-20 9-20-9Z`}
                  fill="#f5ddb0"
                  stroke="#a88a5e"
                  strokeWidth="2"
                />
                <path
                  d={`M${px - 20} ${py - 15}l20 10 20-10M${px} ${py - 5}v30`}
                  fill="none"
                  stroke="#ba9d6d"
                  strokeWidth="2"
                />
                <path
                  d={`M${px - 8} ${py - 20}l20 10v14l-8 3v-14l-20-9Z`}
                  fill="#b49ac5"
                />
                <circle
                  className="handle-focus-ring"
                  cx={px}
                  cy={py}
                  r="31"
                  fill="none"
                  strokeWidth="3"
                />
              </g>
              <text
                x={width * 0.5}
                y="29"
                textAnchor="middle"
                className="island-svg-label"
              >
                验证点 {point.row + 1} · {result.model_name}
              </text>
            </svg>
          </div>
          <div className="forest-gate-buttons">
            {gates.map((name, i) => (
              <button key={name} disabled={!matched} onClick={() => deliver(i)}>
                <i style={{ background: classColors[i] }} />
                {String.fromCharCode(65 + i)}门 <span>{name}</span>
              </button>
            ))}
          </div>
          <ParcelMap result={result} point={point} />
          {rescue && rescued && (
            <section
              className="rescue-comparison"
              aria-label="固定样本的两次判断"
            >
              <h3>点{rescue.row + 1}的两次判断</h3>
              <div>
                <section>
                  <small>起点</small>
                  <strong>{rescue.before.model_name}</strong>
                  <b>
                    <i
                      className="rescue-class-token"
                      style={{ color: classColors[rescued.before_prediction] }}
                    >
                      {String.fromCharCode(65 + rescued.before_prediction)}
                    </i>
                    {gates[rescued.before_prediction]}
                  </b>
                </section>
                <section>
                  <small>现在</small>
                  <strong>{result.model_name}</strong>
                  <b>
                    <i
                      className="rescue-class-token"
                      style={{ color: classColors[rescued.prediction] }}
                    >
                      {String.fromCharCode(65 + rescued.prediction)}
                    </i>
                    {gates[rescued.prediction]}
                  </b>
                </section>
              </div>
            </section>
          )}
          {hint && (
            <p className="forest-delivery-hint" role="status">
              {hint}
            </p>
          )}
          {current && !rescue && (
            <div
              className={`forest-delivery-verdict ${current.gate === point.prediction ? "success" : "retry"}`}
              role="status"
            >
              <strong>
                {current.gate === point.prediction
                  ? "你找到了模型的投递门。"
                  : "先看图，再核对。"}
              </strong>
              {canReveal && (
                <>
                  <p>
                    你的投递：{gates[current.gate]}；模型预测：
                    {gates[point.prediction]}；真实类别：{gates[point.label]}。
                  </p>
                  <p>
                    {point.correct
                      ? "这次模型判断与真实类别一致。"
                      : current.gate === point.prediction
                        ? "你读懂了模型的判断，但这枚样本仍被错分，可以尝试救援。"
                        : "模型在这枚样本上判断错误，可以尝试换模型救援。"}
                  </p>
                  {!point.correct && !rescue && (
                    <button
                      className="button primary"
                      onClick={() => {
                        progress.beginRescue();
                        setCopied(false);
                      }}
                    >
                      固定这次错分，开始救援
                      <ArrowRight size={20} />
                    </button>
                  )}
                </>
              )}
              {current.gate !== point.prediction && (
                <LayeredHint
                  level={progress.hintLevel}
                  onLevel={progress.setHintLevel}
                  onLocate={() => locate("map")}
                  first="先看圆环所在的模型区域，再对应类别门的颜色。猜模型的判断，与真实类别可能不同。"
                  second={`点${point.row + 1}的坐标为(${point.x.toFixed(3)}, ${point.y.toFixed(3)})。模型对原样本判断为${gates[point.prediction]}，真实为${gates[point.label]}；边缘处以原样本判断为准。`}
                  disabled={!matched}
                />
              )}
            </div>
          )}
          <div className="island-forest-controls">
          <h3 className="forest-model-title">换一种投递规则</h3>
          <div
            className="forest-model-choices"
            tabIndex={-1}
            role="group"
            aria-label="投递规则"
          >
            {classModels.map((m) => (
              <button
                key={m.id}
                aria-pressed={input.model === m.id}
                onClick={() => change({ model: m.id as ClassModel })}
              >
                <ModelGlyph id={m.id} />
                {m.name}
              </button>
            ))}
          </div>
          {input.model === "knn" ? (
            <SceneRange
              label="投递站邻居K"
              value={input.neighbors}
              display={`${input.neighbors}个`}
              min={1}
              max={21}
              step={2}
              onChange={(n) => change({ neighbors: n })}
            />
          ) : input.model === "tree" || input.model === "forest" ? (
            <SceneRange
              label="投递站树深"
              value={input.depth}
              display={`${input.depth}层`}
              min={1}
              max={12}
              onChange={(n) => change({ depth: n })}
            />
          ) : (
            <>
              <SceneRange
                label="投递站C档位"
                value={classC.indexOf(input.c)}
                display={`C=${input.c}`}
                min={0}
                max={4}
                onChange={(n) => change({ c: classC[n] })}
              />
              {input.model === "svm" && (
                <SceneRange
                  label="投递站γ档位"
                  value={classGamma.indexOf(input.gamma)}
                  display={`γ=${input.gamma}`}
                  min={0}
                  max={5}
                  onChange={(n) => change({ gamma: classGamma[n] })}
                />
              )}
            </>
          )}
          <div className="forest-real-metrics">
            <span>
              全体验证准确率
              <b>{classPercent(result.metrics.validation_accuracy)}</b>
            </span>
            <span>
              验证错分
              <b>
                {result.metrics.mistakes}/{result.split.validation}
              </b>
            </span>
          </div>
          </div>
        </div>
        <aside className="island-control-desk">
          <IslandJourney panel="forest" input={input} pending={pending}
            onApply={(next, row) => { if (progress.engaged || progress.restoring) progress.pause(); else pauseProgress("forest"); onResumeConsumed(); onInput(next as ClassInput); if (row !== undefined) onSelect(row); }}
            onLocate={() => locate("map")} />
          <details className="island-free-observation"><summary>自由投递与救援</summary>
          <LearningCompanion
            mood={
              rescued?.fixed || current?.gate === point.prediction
                ? "celebrate"
                : rescue || current
                  ? "thinking"
                  : progress.restoring || (progress.paused && !progress.engaged)
                    ? "resume"
                    : "welcome"
            }
            title={
              progress.restoring
                ? "正在续接森林挑战"
                : rescued?.fixed
                  ? "这枚样本已救援"
                  : rescue
                    ? "固定样本，试试新规则"
                    : current?.gate === point.prediction
                      ? "读懂了模型的判断"
                      : current
                        ? "再看一眼图上位置"
                        : progress.paused && !progress.engaged
                          ? "上次的森林挑战还在"
                          : "让包裹找到投递门"
            }
            message={
              progress.restoring
                ? "复算起点后再核对结果。"
                : rescued?.fixed
                  ? "也要看看整体准确率。"
                  : rescue
                    ? matched
                      ? "换一个模型或调整参数。"
                      : "正在核对新的判断。"
                    : current?.gate === point.prediction
                      ? point.correct
                        ? "这次预测与真实类别一致。"
                        : "模型仍把它看错了，可以尝试救援。"
                      : current
                        ? "先用小地图找一条线索。"
                        : "先看位置，再选择模型会走的门。"
            }
            event={progress.motionEvent}
          />
          {(progress.error || progress.saveError) && (
            <p role="alert">
              {progress.error || progress.saveError}
              {progress.error && (
                <button className="text-button" onClick={progress.retry}>
                  重新复算
                </button>
              )}
            </p>
          )}
          {progress.paused && !progress.engaged && !progress.restoring && (
            <button
              className="button secondary continue-forest"
              onClick={() => onResumeRequest(progress.paused!)}
            >
              <BookmarkCheck size={20} />
              继续上次投递
            </button>
          )}

          <label className="island-select">
            选择验证样本
            <select
              aria-label="投递验证样本"
              value={point.row}
              disabled={!matched}
              onChange={(e) => choose(Number(e.target.value))}
            >
              {result.validation.map((p) => (
                <option key={p.row} value={p.row}>
                  点{p.row + 1}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            disabled={!matched}
            onClick={() =>
              choose(
                result.validation[
                  (result.validation.findIndex((p) => p.row === point.row) +
                    1) %
                    result.validation.length
                ].row,
              )
            }
          >
            下一枚样本
            <ArrowRight size={14} />
          </button>
          {rescue ? (
            <section className="island-quest" aria-label="错分救援任务">
              <div className="island-quest-heading">
                <h3>固定点{rescue.row + 1}，尝试修复</h3>
                <HelpHint title="救援的比较条件">
                  <p>
                    只换模型或其参数，保持训练和验证数据不变。修好一个样本也要核对整体准确率；改变数据后暂停判定，可返回起点恢复。
                  </p>
                </HelpHint>
              </div>
              <div
                className={`quest-verdict ${rescued?.fixed ? "success" : ""}`}
                role="status"
              >
                <strong>
                  {!matched ? (
                    "等待这次实算…"
                  ) : !rescued ? (
                    "数据条件已改变，请返回起点或结束任务。"
                  ) : rescued.fixed ? (
                    <>
                      <Check size={16} />
                      这枚样本已改判正确
                    </>
                  ) : (
                    "当前模型仍将它错分，继续尝试。"
                  )}
                </strong>
                {rescued && (
                  <p>
                    全体验证准确率 {classPercent(rescued.before_accuracy)} →{" "}
                    {classPercent(rescued.accuracy)}
                  </p>
                )}
              </div>
              {!rescued?.fixed && (
                <LayeredHint
                  level={progress.rescueHint}
                  onLevel={progress.setRescueHint}
                  onLocate={() =>
                    locate(progress.rescueHint === 0 ? "models" : "map")
                  }
                  first="固定这枚验证样本，只换一种模型或参数，看看同一位置会怎样判断。"
                  second={
                    rescued
                      ? `起点预测为${gates[rescued.before_prediction]}，现在为${gates[rescued.prediction]}，真实为${gates[rescued.label]}。整体验证准确率${classPercent(rescued.before_accuracy)}→${classPercent(rescued.accuracy)}，修好单点也要核对整体。`
                      : "数据条件已改变，先返回救援起点再做比较。"
                  }
                  disabled={!matched || !rescued}
                />
              )}
              <button
                className="text-button"
                onClick={() => {
                  onInput(rescue.before.parameters);
                  onSelect(rescue.row);
                  setCopied(false);
                }}
              >
                <RotateCcw size={14} />
                返回救援起点
              </button>
              <button className="text-button" onClick={progress.endRescue}>
                结束救援
              </button>
            </section>
          ) : null}
          {(canReveal || rescued?.fixed) && (
            <button
              className="text-button"
              disabled={!matched}
              onClick={() => void copy()}
            >
              <Copy size={14} />
              {copied ? "发现回执已复制" : "复制发现回执"}
            </button>
          )}
          {progress.engaged && (
            <button
              className="text-button pause-challenge"
              onClick={progress.pause}
            >
              <BookmarkCheck size={20} />
              暂存森林挑战
            </button>
          )}
          </details>
          <CausalTrace panel="forest" input={input} calculated={result.parameters} pending={pending}
            value={result.metrics.validation_accuracy} metric="验证准确率" onLocate={() => locate("map")} />
        </aside>
      </div>
    </section>
  );
}
