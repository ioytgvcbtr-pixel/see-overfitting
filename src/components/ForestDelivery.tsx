"use client";
import { useEffect, useState, useRef, type PointerEvent } from "react";
import { ArrowRight, Copy, Check, RotateCcw } from "lucide-react";
import {
  classColors,
  classModels,
  classPercent,
  classKey,
  classC,
  classGamma,
  type ClassInput,
  type ClassResult,
  type ClassModel,
} from "@/lib/classification";
import { deliveryGate, rescueObservation } from "@/lib/island-experiments";
import { useChartWidth } from "./useChartWidth";
import { LittleTree, SceneRange } from "./IslandControls";
import ParcelMap from "./ParcelMap";

export default function ForestDelivery({
  input,
  result,
  selected,
  pending,
  onInput,
  onSelect,
  onRescue,
}: {
  input: ClassInput;
  result: ClassResult;
  selected: number | null;
  pending: boolean;
  onInput: (p: ClassInput) => void;
  onSelect: (row: number) => void;
  onRescue: () => void;
}) {
  const { ref, width } = useChartWidth(),
    active = useRef<number | null>(null);
  const point =
    result.validation.find((p) => p.row === selected) ?? result.validation[0];
  const [check, setCheck] = useState<{ key: string; gate: number } | null>(
      null,
    ),
    [hint, setHint] = useState("");
  const [parcel, setParcel] = useState<{ x: number; y: number } | null>(null),
    [focusGate, setFocusGate] = useState(0);
  const [rescue, setRescue] = useState<{
      before: ClassResult;
      row: number;
    } | null>(null),
    [copied, setCopied] = useState(false);
  const key = `${classKey(input)}:${point.row}`,
    matched = !pending && classKey(result.parameters) === classKey(input);
  const current = check?.key === key && matched ? check : null;
  useEffect(() => {
    setCheck(null);
    setCopied(false);
    setHint("");
  }, [key]);
  const rescued =
    rescue && matched
      ? rescueObservation(rescue.before, result, rescue.row)
      : null;
  const gates = result.dataset.classes,
    gx = (i: number) => ((i + 0.5) / gates.length) * width;
  const px = parcel?.x ?? (current ? gx(point.prediction) : width * 0.5),
    py = parcel?.y ?? (current ? 211 : 65);
  function choose(row: number) {
    onSelect(row);
    setCheck(null);
    setHint("");
    setRescue(null);
    setCopied(false);
  }
  function deliver(gate: number) {
    if (!matched) return;
    setCheck({ key, gate });
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
        Math.min(270, ((e.clientY - rect.top) / rect.height) * 270),
      ),
    };
  }
  const change = (patch: Partial<ClassInput>) =>
    onInput({ ...input, ...patch });
  async function copy() {
    if (!matched || (!current && !rescued?.fixed)) return;
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
      className="island-workbench island-forest"
      aria-label="边界森林互动投递站"
    >
      <header className="island-stage-heading">
        <div>
          <span>边界森林 · 模型投递站</span>
          <h2>这一枚，会被送到哪道门？</h2>
        </div>
        <span
          className={`island-freshness ${matched ? "" : "pending"}`}
          role="status"
        >
          {matched ? "投递站已匹配实算" : "更新中 · 读数为最近实算"}
        </span>
      </header>
      <div className="island-workbench-grid">
        <div className="island-scene-column">
          <div className="island-live-scene forest-scene" ref={ref}>
            <svg
              viewBox={`0 0 ${width} 270`}
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
              {current && (
                <path
                  d={`M${width * 0.5} 86Q${width * 0.5} 135 ${gx(point.prediction)} 208`}
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
                    y="140"
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
                    d={`M${gx(i) - 26} 215v-45q26-37 52 0v45`}
                    fill="none"
                    stroke="#c6b28c"
                    strokeWidth="7"
                  />
                  <text
                    x={gx(i)}
                    y="183"
                    textAnchor="middle"
                    fontSize="22"
                    fill={classColors[i]}
                    fontWeight="700"
                  >
                    {String.fromCharCode(65 + i)}
                  </text>
                  <path
                    d={`M${gx(i) - 38} 228h76`}
                    stroke="#bba77e"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  {current?.gate === i && (
                    <path
                      d={`M${gx(i) - 17} 126h34`}
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
                    y="131"
                    width="84"
                    height="108"
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
                  if (pos.y >= 135)
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
          <p className="island-scale-note">
            门代表模型输出类别。包裹移动只是投递操作，不改变验证点的特征或标签；真实边界图在下方。
          </p>
          {hint && (
            <p className="forest-delivery-hint" role="status">
              {hint}
            </p>
          )}
          {current && (
            <div
              className={`forest-delivery-verdict ${current.gate === point.prediction ? "success" : "retry"}`}
              role="status"
            >
              <strong>
                {current.gate === point.prediction
                  ? "你找到了模型的投递门。"
                  : "模型实际会走另一道门。"}
              </strong>
              <p>
                你的投递：{gates[current.gate]}；模型预测：
                {gates[point.prediction]}；真实类别：{gates[point.label]}。
              </p>
              <p>
                {point.correct
                  ? "这次模型判断与真实类别一致。"
                  : "你可以猜中模型的判断，而模型仍把真实类别看错。试着修复它。"}
              </p>
              {!point.correct && !rescue && (
                <button
                  className="button primary"
                  onClick={() => {
                    setRescue({ before: result, row: point.row });
                    onSelect(point.row);
                    onRescue();
                    setCopied(false);
                  }}
                >
                  固定这次错分，开始救援
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
        </div>
        <aside className="island-control-desk">
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
          <h3 className="forest-model-title">换一种投递规则</h3>
          <div className="forest-model-choices">
            {classModels.map((m) => (
              <button
                key={m.id}
                aria-pressed={input.model === m.id}
                onClick={() => change({ model: m.id as ClassModel })}
              >
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
              max={31}
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
          {rescue ? (
            <section className="island-quest" aria-label="错分救援任务">
              <div className="island-quest-heading">
                <h3>固定点{rescue.row + 1}，尝试修复</h3>
              </div>
              <p>
                只换模型或其参数，保持数据条件，观察它的判断和全体验证表现。
              </p>
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
                    {classPercent(rescued.accuracy)}。修好一个点也要核对整体。
                  </p>
                )}
              </div>
              <button
                className="text-button"
                onClick={() => {
                  onInput(rescue.before.parameters);
                  onSelect(rescue.row);
                  setCheck(null);
                  setCopied(false);
                }}
              >
                <RotateCcw size={14} />
                返回救援起点
              </button>
              <button className="text-button" onClick={() => setRescue(null)}>
                结束救援
              </button>
            </section>
          ) : (
            <p className="forest-task-invitation">
              先预测模型会把包裹投向哪类，再投递核对。发现错分后，可固定样本并尝试救援。
            </p>
          )}
          {(current || rescued?.fixed) && (
            <button
              className="text-button"
              disabled={!matched}
              onClick={() => void copy()}
            >
              <Copy size={14} />
              {copied ? "发现回执已复制" : "复制发现回执"}
            </button>
          )}
          <small className="forest-grade-note">
            探索玩法不计正式成绩，任务仅保留在本页。
          </small>
        </aside>
      </div>
    </section>
  );
}
