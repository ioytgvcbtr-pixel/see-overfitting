"use client";
import { useEffect, useId, useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import {
  alphaText,
  bounded,
  conceptAlphas,
  conceptNumber,
  type ConceptInput,
  type ConceptResult,
} from "@/lib/concepts";
import { visualScenes } from "@/lib/visual-scenes";
import { useChartWidth } from "./useChartWidth";
import { LittleTree, SceneHandle, SceneRange } from "./IslandControls";
import SceneArtwork from "./SceneArtwork";
import ConceptQuest from "./ConceptQuest";

export default function ConceptIsland({
  input,
  result,
  selected,
  pending,
  onSelect,
  onInput,
  onPoint,
  onDrag,
}: {
  input: ConceptInput;
  result: ConceptResult;
  selected: number;
  pending: boolean;
  onSelect: (i: number) => void;
  onInput: (p: ConceptInput) => void;
  onPoint: (i: number, y: number) => void;
  onDrag: (v: boolean) => void;
}) {
  const { ref, width } = useChartWidth(),
    id = useId().replace(/:/g, "");
  const [zoomScale, setZoomScale] = useState<number | null>(null);
  useEffect(() => setZoomScale(null), [input.degree, result.data_fingerprint]);
  const p = result.train[selected] ?? result.train[0],
    pointIndex = p === result.train[selected] ? selected : 0;
  const sameSamples = ["seed", "samples", "noise"].every(
    (k) =>
      input[k as keyof ConceptInput] ===
      result.parameters[k as keyof ConceptInput],
  );
  const liveY = sameSamples
    ? (input.edits.find((e) => e.index === pointIndex)?.y ?? p.original_y)
    : p.y;
  const set = (
    key: "slope" | "intercept" | "degree" | "alpha",
    value: number,
  ) => onInput({ ...input, [key]: value });
  const height = input.panel === "sensitivity" ? 360 : 320;
  const y = (v: number) => 48 + ((3 - bounded(v, -3, 3)) / 6) * 210;
  const lakeX = width * 0.36,
    boatX = width * 0.67,
    predicted = result.linear?.residuals[pointIndex]?.predicted ?? 0;
  const movePoint = (value: number) => {
    if (sameSamples) onPoint(pointIndex, value);
  };
  const title =
    input.panel === "error"
      ? "把两种高度，放在同一把尺上。"
      : input.panel === "sensitivity"
        ? "拉动路钉，两条路一起回应。"
        : "转动约束，看枝条怎样收缩。";
  const plant = result.regularization;
  const indices = plant
    ? plant.weak.weights
        .map((v, i) => ({
          i,
          v: Math.max(Math.abs(v), Math.abs(plant.current.weights[i])),
        }))
        .sort((a, b) => b.v - a.v)
        .slice(0, width < 450 ? 4 : 6)
        .sort((a, b) => a.i - b.i)
        .map((v) => v.i)
    : [];
  const maximum =
    zoomScale ??
    (plant
      ? Math.max(
          ...plant.weak.weights.map(Math.abs),
          ...plant.current.weights.map(Math.abs),
          1e-12,
        )
      : 1);
  return (
    <section
      className={`island-workbench island-${input.panel}`}
      aria-label={`${visualScenes[input.panel].name}互动场景`}
    >
      <header className="island-stage-heading">
        <SceneArtwork scene={input.panel} sizes="76px" />
        <div>
          <span>{visualScenes[input.panel].name} · 动手观察</span>
          <h2>{title}</h2>
        </div>
        <span
          className={`island-freshness ${pending ? "pending" : ""}`}
          role="status"
        >
          {pending ? "输入预览 · 读数为最近实算" : "场景已匹配实算"}
        </span>
      </header>
      <div className="island-workbench-grid">
        <div className="island-scene-column">
          <div className="island-live-scene" ref={ref}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="group"
              aria-label={
                input.panel === "error"
                  ? "浮标观测与模型小船的残差场景"
                  : input.panel === "sensitivity"
                    ? "同一训练路钉牵引的两条真实拟合道路"
                    : "系数枝条与可转动的正则化旋钮"
              }
            >
              <defs>
                <linearGradient id={`${id}-water`} x2="0" y2="1">
                  <stop stopColor="#e7f6f0" />
                  <stop offset="1" stopColor="#b1d9d2" />
                </linearGradient>
                <linearGradient id={`${id}-pot`}>
                  <stop stopColor="#b199c3" />
                  <stop offset="1" stopColor="#d8c8df" />
                </linearGradient>
              </defs>
              {input.panel === "error" && result.linear && (
                <>
                  <path
                    d={`M45 80 C${width * 0.2} 10 ${width * 0.5} 37 ${width * 0.68} 53 S${width - 8} 25 ${width - 22} 138 S${width - 30} 282 ${width * 0.65} 278 S${width * 0.21} 315 46 256 S10 157 45 80`}
                    fill="#d4dfc2"
                    stroke="#b4bd9d"
                    strokeWidth="3"
                  />
                  <path
                    d={`M52 85 C${width * 0.2} 28 ${width * 0.5} 48 ${width * 0.68} 65 S${width - 18} 43 ${width - 33} 140 S${width - 37} 266 ${width * 0.65} 265 S${width * 0.21} 299 55 247 S24 160 52 85`}
                    fill={`url(#${id}-water)`}
                  />
                  {[0.16, 0.78, 0.87].map((v, i) => (
                    <g key={v} aria-hidden="true">
                      <ellipse
                        cx={width * v}
                        cy={i ? 250 : 75}
                        rx="17"
                        ry="6"
                        fill="#86ae85"
                      />
                      <path
                        d={`M${width * v} ${i ? 245 : 70}q8-13 16 0q-8 9-16 0`}
                        fill="#cfb4c8"
                      />
                    </g>
                  ))}
                  {[3, 0, -3].map((v) => (
                    <g key={v}>
                      <path
                        d={`M30 ${y(v)}H${width - 25}`}
                        stroke="#418f7c"
                        opacity=".18"
                        strokeDasharray="4 7"
                      />
                      <text x="16" y={y(v) + 4} className="island-svg-label">
                        {v}
                      </text>
                    </g>
                  ))}
                  <text x="12" y="24" className="island-svg-label">
                    y
                  </text>
                  <LittleTree x={width - 35} y={height - 18} scale={0.65} />
                  <LittleTree x={65} y={40} scale={0.55} />
                  <path
                    d={`M${lakeX} ${y(p.y)}H${width * 0.51}V${y(predicted)}H${boatX}`}
                    fill="none"
                    stroke="#8260a4"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                  <path
                    d={`M${width * 0.51 - 5} ${y(p.y)}h10M${width * 0.51 - 5} ${y(predicted)}h10`}
                    stroke="#8260a4"
                    strokeWidth="2"
                  />
                  <text
                    x={width * 0.51 + 10}
                    y={(y(p.y) + y(predicted)) / 2 - 8}
                    className="island-svg-label"
                  >
                    e
                  </text>
                  <SceneHandle
                    label={`训练浮标${pointIndex + 1}高度`}
                    value={liveY}
                    min={-3}
                    max={3}
                    x={lakeX}
                    y={y(liveY)}
                    start={258}
                    end={48}
                    onChange={movePoint}
                    onDrag={onDrag}
                  >
                    <ellipse
                      cx={lakeX}
                      cy={y(liveY) + 8}
                      rx="25"
                      ry="7"
                      fill="#388c7d"
                      opacity=".15"
                    />
                    <path
                      d={`M${lakeX} ${y(liveY) + 5}v-27l20 8-20 7`}
                      fill="#e79a7f"
                      stroke="#806263"
                      strokeWidth="2"
                    />
                    <ellipse
                      cx={lakeX}
                      cy={y(liveY) + 3}
                      rx="17"
                      ry="9"
                      fill="#fff8e4"
                      stroke="#257f72"
                      strokeWidth="3"
                    />
                    <circle cx={lakeX} cy={y(liveY) - 2} r="5" fill="#258e7d" />
                  </SceneHandle>
                  <g
                    transform={`translate(${boatX},${y(predicted)})`}
                    aria-hidden="true"
                  >
                    <path
                      d="M-29 3h58L18 17h-33Z"
                      fill="#8972af"
                      stroke="#655087"
                      strokeWidth="2"
                    />
                    <path
                      d="M0 3v-40L-22-5H0M4-35L23-5H4"
                      fill="#fff8e8"
                      stroke="#cfb4a0"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M-35 23q12-5 24 0t25 0t21 0"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3"
                    />
                  </g>
                  <text
                    x={lakeX}
                    y="298"
                    textAnchor="middle"
                    className="island-svg-label"
                  >
                    训练浮标 y
                  </text>
                  <text
                    x={boatX}
                    y="298"
                    textAnchor="middle"
                    className="island-svg-label"
                  >
                    模型小船 ŷ
                  </text>
                  {Math.abs(predicted) > 3 && (
                    <text
                      x={boatX}
                      y="280"
                      textAnchor="middle"
                      className="island-svg-label"
                    >
                      预测超出±3窗口
                    </text>
                  )}
                </>
              )}
              {input.panel === "sensitivity" && result.pairs && (
                <>
                  <path
                    d={`M15 145L${width * 0.2} 32L${width * 0.38} 100L${width * 0.63} 15L${width - 15} 135Z`}
                    fill="#e9e0f0"
                  />
                  <path
                    d={`M${width * 0.63} 15l-25 39 35-9 27 27Z`}
                    fill="#fbf8fc"
                  />
                  <LittleTree x={width - 25} y={335} scale={0.7} />
                  {result.pairs.map((pair, index) => {
                    const top = 40 + index * 156,
                      bottom = top + 115,
                      sx = (v: number) => 40 + v * (width - 75),
                      sy = (v: number) =>
                        top + ((3 - bounded(v, -3, 3)) / 6) * (bottom - top);
                    const road = (values: number[]) =>
                      values
                        .map(
                          (v, i) =>
                            `${i ? "L" : "M"}${sx(result.grid_x[i]).toFixed(2)},${(top + ((3 - bounded(v, -100, 100)) / 6) * (bottom - top)).toFixed(2)}`,
                        )
                        .join(" ");
                    const clip = `${id}-road-${index}`;
                    return (
                      <g key={index}>
                        <defs>
                          <clipPath id={clip}>
                            <rect
                              x="35"
                              y={top - 3}
                              width={width - 65}
                              height={bottom - top + 6}
                              rx="10"
                            />
                          </clipPath>
                        </defs>
                        <rect
                          x="30"
                          y={top - 4}
                          width={width - 55}
                          height={bottom - top + 8}
                          rx="20"
                          fill={index ? "#f1e9f6" : "#e3f0eb"}
                        />
                        <text x="38" y={top - 14} className="island-svg-label">
                          {index
                            ? `观察B · ${pair.edited.degree}阶`
                            : "参考A · 3阶"}
                        </text>
                        <g clipPath={`url(#${clip})`}>
                          <path
                            d={road(pair.baseline.curve)}
                            fill="none"
                            stroke="#948b9f"
                            strokeWidth="2"
                            strokeDasharray="5 5"
                          />
                          <path
                            d={road(pair.edited.curve)}
                            fill="none"
                            stroke={index ? "#a28abd" : "#7fa897"}
                            strokeWidth="10"
                          />
                          <path
                            d={road(pair.edited.curve)}
                            fill="none"
                            stroke="#fff9e9"
                            strokeWidth="1.5"
                            strokeDasharray="3 5"
                          />
                        </g>
                        <path
                          d={`M${sx(p.x)} ${top}V${bottom}`}
                          stroke="#8f809f"
                          opacity=".35"
                          strokeDasharray="3 4"
                        />
                        <SceneHandle
                          label={`${index ? "B" : "A"}路训练路钉${pointIndex + 1}`}
                          value={liveY}
                          min={-3}
                          max={3}
                          x={sx(p.x)}
                          y={sy(liveY)}
                          start={bottom}
                          end={top}
                          onChange={movePoint}
                          onDrag={onDrag}
                        >
                          <circle
                            cx={sx(p.x)}
                            cy={sy(liveY) + 3}
                            r="11"
                            fill="#aa8e72"
                          />
                          <circle
                            cx={sx(p.x)}
                            cy={sy(liveY)}
                            r="9"
                            fill="#f8c77a"
                            stroke="#946a46"
                            strokeWidth="2"
                          />
                          <path
                            d={`M${sx(p.x) - 3} ${sy(liveY)}h6`}
                            stroke="#fff6df"
                            strokeWidth="2"
                          />
                        </SceneHandle>
                        <text
                          x={width - 36}
                          y={bottom - 8}
                          textAnchor="end"
                          className="island-svg-label"
                        >
                          RMS {conceptNumber(pair.shift_rms)}
                        </text>
                        {pair.edited.curve.some((v) => Math.abs(v) > 3) && (
                          <text
                            x="40"
                            y={bottom - 8}
                            className="island-svg-label"
                          >
                            道路超出±3窗口
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <text x="38" y="350" className="island-svg-label">
                    两路同一y刻度 −3～3；虚线为扰动前
                  </text>
                </>
              )}
              {plant && (
                <>
                  <path
                    d={`M20 251Q${width * 0.3} 230 ${width * 0.5} 244T${width - 20} 242L${width - 14} 294Q${width * 0.5} 322 20 293Z`}
                    fill="#d6dfbc"
                  />
                  <path
                    d={`M20 290Q${width * 0.5} 317 ${width - 14} 291v12Q${width * 0.5} 334 25 307Z`}
                    fill="#c4b399"
                  />
                  <LittleTree x={width - 30} y={95} scale={0.8} />
                  <SceneHandle
                    label="约束旋钮α档位"
                    value={conceptAlphas.indexOf(input.alpha)}
                    min={0}
                    max={7}
                    step={1}
                    x={Math.min(110, width * 0.3)}
                    y={85}
                    start={0}
                    end={1}
                    dial
                    onChange={(n) => set("alpha", conceptAlphas[n])}
                    onDrag={onDrag}
                  >
                    <circle
                      cx={Math.min(110, width * 0.3)}
                      cy="91"
                      r="45"
                      fill="#a895b2"
                    />
                    <circle
                      cx={Math.min(110, width * 0.3)}
                      cy="85"
                      r="43"
                      fill="#fcf5e4"
                      stroke="#cebaa3"
                      strokeWidth="3"
                    />
                    {conceptAlphas.map((_, i) => {
                      const a = ((-135 + (i / 7) * 270) * Math.PI) / 180,
                        cx = Math.min(110, width * 0.3);
                      return (
                        <circle
                          key={i}
                          cx={cx + Math.sin(a) * 34}
                          cy={85 - Math.cos(a) * 34}
                          r="2.5"
                          fill={
                            i === conceptAlphas.indexOf(input.alpha)
                              ? "#7546c8"
                              : "#b8a8c7"
                          }
                        />
                      );
                    })}
                    <path
                      d={`M${Math.min(110, width * 0.3)} 85l${Math.sin(((-135 + (conceptAlphas.indexOf(input.alpha) / 7) * 270) * Math.PI) / 180) * 24} ${-Math.cos(((-135 + (conceptAlphas.indexOf(input.alpha) / 7) * 270) * Math.PI) / 180) * 24}`}
                      stroke="#8d6c9f"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  </SceneHandle>
                  <text
                    x={Math.min(110, width * 0.3)}
                    y="150"
                    textAnchor="middle"
                    className="island-svg-label"
                  >
                    α = {alphaText(input.alpha)}
                  </text>
                  <text
                    x={width * 0.6}
                    y="55"
                    textAnchor="middle"
                    className="island-svg-label"
                  >
                    同一特征基
                  </text>
                  <text
                    x={width * 0.6}
                    y="76"
                    textAnchor="middle"
                    className="island-svg-label"
                  >
                    虚影：弱约束
                  </text>
                  {indices.map((index, i) => {
                    const px = 38 + ((i + 0.5) / indices.length) * (width - 76),
                      rawHeight =
                        (Math.abs(plant.current.weights[index]) / maximum) *
                        100,
                      rawWeak =
                        (Math.abs(plant.weak.weights[index]) / maximum) * 100,
                      h = Math.min(rawHeight, 100),
                      weak = Math.min(rawWeak, 100);
                    return (
                      <g key={index} aria-hidden="true">
                        <path
                          d={`M${px - 4} 257v${-weak}`}
                          stroke="#a8a0af"
                          strokeWidth="2"
                          strokeDasharray="3 3"
                        />
                        {rawWeak > 100 && (
                          <text
                            x={px - 7}
                            y="151"
                            textAnchor="middle"
                            className="island-svg-label"
                          >
                            ↑
                          </text>
                        )}
                        {rawHeight > 100 && (
                          <text
                            x={px + 7}
                            y="151"
                            textAnchor="middle"
                            className="island-svg-label"
                          >
                            ↑
                          </text>
                        )}
                        <path
                          d={`M${px + 3} 257v${-h}`}
                          stroke={
                            plant.current.weights[index] < 0
                              ? "#9970b1"
                              : "#6f9b72"
                          }
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                        {h > 5 && (
                          <>
                            <ellipse
                              cx={px - 3}
                              cy={257 - h * 0.7}
                              rx="10"
                              ry="4"
                              transform={`rotate(30 ${px - 3} ${257 - h * 0.7})`}
                              fill={
                                plant.current.weights[index] < 0
                                  ? "#c4afd6"
                                  : "#b6ca94"
                              }
                            />
                            <ellipse
                              cx={px + 8}
                              cy={257 - h * 0.9}
                              rx="10"
                              ry="4"
                              transform={`rotate(-30 ${px + 8} ${257 - h * 0.9})`}
                              fill={
                                plant.current.weights[index] < 0
                                  ? "#a985bc"
                                  : "#92b17e"
                              }
                            />
                          </>
                        )}
                        <path
                          d={`M${px - 17} 257h34l-5 23h-24Z`}
                          fill={`url(#${id}-pot)`}
                        />
                        <path d={`M${px - 20} 257h40v7h-40Z`} fill="#a98db9" />
                        <text
                          x={px}
                          y="299"
                          textAnchor="middle"
                          className="island-svg-label"
                        >
                          w{index + 1}
                          {plant.current.weights[index] < 0 ? " −" : " +"}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}
            </svg>
          </div>
          {plant && (
            <div className="garden-zoom">
              <button
                className="text-button"
                aria-pressed={zoomScale !== null}
                disabled={pending}
                onClick={() =>
                  setZoomScale(
                    zoomScale === null
                      ? Math.max(...plant.current.weights.map(Math.abs), 1e-12)
                      : null,
                  )
                }
              >
                {zoomScale === null ? "放大当前枝条" : "恢复全量刻度"}
              </button>
              <span>
                线性窗口 |w| ≤ {conceptNumber(maximum)}
                {zoomScale !== null
                  ? "；↑表示超出窗口，缩放后不跨视图比高度。"
                  : "；当前与虚影共用刻度。"}
              </span>
            </div>
          )}
          <div className="island-readouts" aria-label="场景实算读数">
            {result.linear && (
              <>
                <span>
                  浮标 y <b>{conceptNumber(p.y)}</b>
                </span>
                <span>
                  小船 ŷ <b>{conceptNumber(predicted)}</b>
                </span>
                <span>
                  残差 e{" "}
                  <b>
                    {conceptNumber(
                      result.linear.residuals[pointIndex]?.error ?? 0,
                    )}
                  </b>
                </span>
                <span>
                  平方项 e²{" "}
                  <b>
                    {conceptNumber(
                      result.linear.residuals[pointIndex]?.squared ?? 0,
                    )}
                  </b>
                </span>
                <span>
                  训练MSE <b>{conceptNumber(result.linear.train_mse)}</b>
                </span>
                <span>
                  验证MSE <b>{conceptNumber(result.linear.validation_mse)}</b>
                </span>
              </>
            )}
            {result.pairs &&
              result.pairs.map((pair, i) => (
                <span key={i}>
                  {i ? "B" : "A"}当前验证MSE{" "}
                  <b>{conceptNumber(pair.edited.validation_mse)}</b>
                </span>
              ))}
            {plant && (
              <>
                <span>
                  当前系数范数 <b>{conceptNumber(plant.current.weight_norm)}</b>
                </span>
                <span>
                  验证MSE <b>{conceptNumber(plant.current.validation_mse)}</b>
                </span>
              </>
            )}
          </div>
          <p className="island-scale-note">
            {input.panel === "error"
              ? `放大观察点${pointIndex + 1}（x=${p.x.toFixed(3)}）；浮标和小船共享y刻度，残差取自最近实算。`
              : input.panel === "sensitivity"
                ? "道路形状来自161个固定x处的真实预测；两枚路钉操作同一训练点。"
                : "茎高＝|系数|，当前与弱约束共用线性刻度；显示较大的系数，正负另作标记。枝条太小时可放大，完整系数在下方。"}
          </p>
          {plant && (
            <p className="island-coefficient-key">
              {indices.map((i) => (
                <span key={i}>
                  w{i + 1} = {conceptNumber(plant.current.weights[i])}
                </span>
              ))}
            </p>
          )}
        </div>
        <aside className="island-control-desk" aria-label="场景操作与任务">
          <div className="island-object-controls">
            {input.panel !== "regularization" && (
              <>
                <label className="island-select">
                  {input.panel === "error" ? "选择训练浮标" : "选择训练路钉"}
                  <select
                    aria-label="场景训练点"
                    value={pointIndex}
                    disabled={!sameSamples}
                    onChange={(e) => onSelect(Number(e.target.value))}
                  >
                    {result.train.map((point, i) => (
                      <option key={i} value={i}>
                        点{i + 1} · x={point.x.toFixed(3)}
                      </option>
                    ))}
                  </select>
                </label>
                <SceneRange
                  label="场景样本高度y"
                  value={liveY}
                  display={liveY.toFixed(3)}
                  min={-3}
                  max={3}
                  step={0.01}
                  onChange={movePoint}
                />
                <div className="island-nudges">
                  <button
                    disabled={!sameSamples}
                    onClick={() => movePoint(bounded(liveY - 0.1, -3, 3))}
                  >
                    <ArrowDown size={14} />
                    下降0.1
                  </button>
                  <button
                    disabled={!sameSamples}
                    onClick={() => movePoint(bounded(liveY + 0.1, -3, 3))}
                  >
                    <ArrowUp size={14} />
                    上升0.1
                  </button>
                  <button
                    onClick={() =>
                      onInput({
                        ...input,
                        edits: input.edits.filter(
                          (e) => e.index !== pointIndex,
                        ),
                      })
                    }
                  >
                    <RotateCcw size={14} />
                    还原此点
                  </button>
                </div>
              </>
            )}
            {input.panel === "error" ? (
              <>
                <SceneRange
                  label="船帆斜率a"
                  value={input.slope}
                  display={input.slope.toFixed(3)}
                  min={-4}
                  max={4}
                  step={0.001}
                  onChange={(n) => set("slope", n)}
                />
                <SceneRange
                  label="船身截距b"
                  value={input.intercept}
                  display={input.intercept.toFixed(3)}
                  min={-2}
                  max={2}
                  step={0.001}
                  onChange={(n) => set("intercept", n)}
                />
              </>
            ) : (
              <>
                <SceneRange
                  label={
                    input.panel === "sensitivity"
                      ? "观察模型B阶数"
                      : "工坊多项式阶数"
                  }
                  value={input.degree}
                  display={`${input.degree}阶`}
                  min={1}
                  max={15}
                  onChange={(n) => set("degree", n)}
                />
                <SceneRange
                  label={
                    input.panel === "sensitivity"
                      ? "两组共同正则化α"
                      : "工坊正则化强度α"
                  }
                  value={conceptAlphas.indexOf(input.alpha)}
                  display={`α=${alphaText(input.alpha)}`}
                  min={0}
                  max={7}
                  onChange={(n) => set("alpha", conceptAlphas[n])}
                />
              </>
            )}
          </div>
          <ConceptQuest
            input={input}
            result={result}
            pending={pending}
            onInput={onInput}
          />
        </aside>
      </div>
    </section>
  );
}
