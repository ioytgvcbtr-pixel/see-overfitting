"use client";
import { useEffect, useId, useRef } from "react";
import { useChartWidth } from "./useChartWidth";
import {
  bounded,
  conceptNumber,
  weightFromPosition,
  alphaText,
  type ConceptInput,
  type ConceptResult,
  type ConceptModel,
} from "@/lib/concepts";

export function ConceptFitPlot({
  result,
  input,
  curve,
  baseline,
  selected,
  onSelect,
  onEdit,
  onDrag,
  residuals = false,
  label,
}: {
  result: ConceptResult;
  input: ConceptInput;
  curve: number[];
  baseline?: number[];
  selected: number;
  onSelect: (index: number) => void;
  onEdit: (index: number, y: number) => void;
  onDrag: (value: boolean) => void;
  residuals?: boolean;
  label: string;
}) {
  const { ref, width } = useChartWidth();
  const svg = useRef<SVGSVGElement>(null);
  const active = useRef<number | null>(null);
  const id = useId().replace(/:/g, "");
  const height = width < 450 ? 300 : 330,
    left = 42,
    right = 18,
    top = 18,
    bottom = 40;
  const extent = result.y_extent,
    x = (value: number) => left + value * (width - left - right),
    y = (value: number) =>
      top + ((extent - value) / (2 * extent)) * (height - top - bottom);
  const compatible =
    input.seed === result.parameters.seed &&
    input.samples === result.parameters.samples &&
    input.noise === result.parameters.noise;
  const displayed = result.train.map((p, index) => ({
    ...p,
    y: compatible
      ? (input.edits.find((edit) => edit.index === index)?.y ?? p.original_y)
      : p.y,
  }));
  const path = (values: number[]) =>
    values
      .map(
        (v, i) =>
          `${i ? "L" : "M"}${x(result.grid_x[i]).toFixed(2)},${y(bounded(v, -extent * 100, extent * 100)).toFixed(2)}`,
      )
      .join(" ");
  function move(clientY: number, index: number) {
    const bounds = svg.current!.getBoundingClientRect();
    const plotY = ((clientY - bounds.top) / bounds.height) * height;
    onEdit(
      index,
      bounded(
        extent - ((plotY - top) / (height - top - bottom)) * 2 * extent,
        -3,
        3,
      ),
    );
  }
  const error = result.linear?.residuals[selected]?.error || 0;
  const squareSide = (Math.abs(error) / (2 * extent)) * (height - top - bottom);
  const p = result.train[selected];
  const prediction = result.linear?.residuals[selected]?.predicted ?? 0;
  const squareClipped =
    residuals &&
    p &&
    (x(p.x) + squareSide > width - right ||
      Math.min(y(p.y), y(prediction)) < top ||
      Math.min(y(p.y), y(prediction)) + squareSide > height - bottom);
  const clipped =
    squareClipped ||
    [...curve, ...(baseline || [])].some((value) => Math.abs(value) > extent);
  return (
    <div ref={ref} className="concept-fit-figure">
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={label}
      >
        <defs>
          <clipPath id={id}>
            <rect
              x={left}
              y={top}
              width={width - left - right}
              height={height - top - bottom}
            />
          </clipPath>
        </defs>
        {[-extent, -extent / 2, 0, extent / 2, extent].map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              stroke="#e6e0ed"
              strokeDasharray={value === 0 ? undefined : "3 5"}
            />
            <text
              x={left - 8}
              y={y(value) + 4}
              textAnchor="end"
              className="axis-text"
            >
              {value.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((value) => (
          <g key={value}>
            <line
              x1={x(value)}
              x2={x(value)}
              y1={top}
              y2={height - bottom}
              stroke="#f0ecf5"
            />
            <text
              x={x(value)}
              y={height - 19}
              textAnchor="middle"
              className="axis-text"
            >
              {value}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${id})`}>
          <path
            d={path(result.truth)}
            fill="none"
            stroke="#8d839b"
            strokeDasharray="3 7"
            strokeWidth="1.4"
          />
          {result.validation.map((point, i) => (
            <rect
              key={i}
              x={x(point.x) - 2.2}
              y={y(point.y) - 2.2}
              width="4.4"
              height="4.4"
              fill="none"
              stroke="var(--coral)"
              opacity=".45"
            />
          ))}
          {baseline && (
            <path
              d={path(baseline)}
              fill="none"
              stroke="#8c80a4"
              strokeDasharray="7 5"
              strokeWidth="2"
            />
          )}
          {residuals &&
            result.linear?.residuals.map((row, i) => (
              <line
                key={i}
                x1={x(result.train[i].x)}
                x2={x(result.train[i].x)}
                y1={y(result.train[i].y)}
                y2={y(row.predicted)}
                stroke="var(--coral)"
                strokeWidth={i === selected ? 3 : 1}
                opacity={i === selected ? 1 : 0.4}
              />
            ))}
          {residuals && p && (
            <rect
              x={x(p.x)}
              y={Math.min(y(p.y), y(prediction))}
              width={squareSide}
              height={squareSide}
              fill="var(--coral)"
              fillOpacity=".14"
              stroke="var(--coral)"
              strokeDasharray="3 3"
            />
          )}
          <path
            d={path(curve)}
            fill="none"
            stroke="var(--blue)"
            strokeWidth="2.8"
          />
          {displayed.map((point, i) => (
            <g
              key={i}
              data-point-index={i}
              role="slider"
              tabIndex={i === selected ? 0 : -1}
              aria-label={`训练点 ${i + 1}，上下拖动`}
              aria-valuemin={-3}
              aria-valuemax={3}
              aria-valuenow={point.y}
              onFocus={() => onSelect(i)}
              onKeyDown={(event) => {
                if (
                  ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  onEdit(
                    i,
                    event.key === "Home"
                      ? -3
                      : event.key === "End"
                        ? 3
                        : point.y +
                          (event.key === "ArrowUp" ? 1 : -1) *
                            (event.shiftKey ? 0.25 : 0.05),
                  );
                }
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                active.current = i;
                onSelect(i);
                onDrag(true);
              }}
              onPointerMove={(event) => {
                if (active.current === i) move(event.clientY, i);
              }}
              onPointerUp={(event) => {
                if (active.current === i) {
                  move(event.clientY, i);
                  active.current = null;
                  onDrag(false);
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              onPointerCancel={() => {
                active.current = null;
                onDrag(false);
              }}
              className={`concept-drag-point ${i === selected ? "selected" : ""}`}
            >
              <circle
                cx={x(point.x)}
                cy={y(point.y)}
                r="16"
                fill="transparent"
              />
              {i === selected && (
                <g aria-hidden="true" pointerEvents="none">
                  <path
                    d={`M${x(point.x) - 4},${y(point.y) - 16}l4-4 4 4M${x(point.x) - 4},${y(point.y) + 16}l4 4 4-4`}
                    fill="none"
                    stroke="var(--teal)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={x(point.x)}
                    cy={y(point.y)}
                    r="10"
                    fill="var(--teal)"
                    fillOpacity=".12"
                  />
                </g>
              )}
              <circle
                cx={x(point.x)}
                cy={y(point.y)}
                r={i === selected ? 5.7 : 4.4}
                fill="var(--teal)"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          ))}
        </g>
        <text
          x={width - right}
          y={height - 1}
          textAnchor="end"
          className="axis-label"
        >
          输入特征 x
        </text>
        <text x="12" y="13" className="axis-label">
          y
        </text>
      </svg>
      {clipped && (
        <p className="concept-clip">
          部分曲线或误差方块超出视窗；误差仍按完整数据计算。
        </p>
      )}
      <div className="concept-legend">
        <span>
          <i className="train-dot" />
          可拖拽训练点
        </span>
        <span>
          <i className="validation-square" />
          固定验证点
        </span>
        <span>
          <i className="model-line" />
          当前模型
        </span>
        <span>
          <i className="truth-line" />
          合成数据的生成规律
        </span>
        {baseline && (
          <span>
            <i className="reference-line" />
            对照模型
          </span>
        )}
      </div>
    </div>
  );
}

export function LossLandscape({
  result,
  input,
  onWeights,
  onDrag,
}: {
  result: ConceptResult;
  input: ConceptInput;
  onWeights: (a: number, b: number) => void;
  onDrag: (value: boolean) => void;
}) {
  const { ref, width } = useChartWidth();
  const canvas = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const height = 320;
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !result.linear) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(width * dpr);
    el.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const left = 44,
      top = 18,
      w = width - 64,
      h = height - 54;
    const surface = result.linear.surface;
    const lo = Math.log1p(surface.minimum),
      hi = Math.log1p(surface.maximum);
    for (let row = 0; row < surface.rows; row++)
      for (let col = 0; col < surface.columns; col++) {
        const t = bounded(
          (Math.log1p(surface.values[row * surface.columns + col]) - lo) /
            (hi - lo || 1),
          0,
          1,
        );
        const start = [246, 243, 254],
          end = [57, 31, 104];
        const rgb = start.map((v, i) => Math.round(v + (end[i] - v) * t));
        ctx.fillStyle = `rgb(${rgb.join(",")})`;
        ctx.fillRect(
          left + (col / surface.columns) * w,
          top + (row / surface.rows) * h,
          w / surface.columns + 1,
          h / surface.rows + 1,
        );
      }
    const x = (a: number) => left + ((a + 4) / 8) * w,
      y = (b: number) => top + ((2 - b) / 4) * h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,.65)";
    surface.contours.forEach((contour) => {
      ctx.beginPath();
      contour.points.forEach(([a, b], i) =>
        i ? ctx.lineTo(x(a), y(b)) : ctx.moveTo(x(a), y(b)),
      );
      ctx.closePath();
      ctx.stroke();
    });
    const optimum = result.linear.optimum;
    ctx.beginPath();
    ctx.arc(x(optimum.slope), y(optimum.intercept), 6, 0, Math.PI * 2);
    ctx.fillStyle = "#087e83";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    const px = x(input.slope),
      py = y(input.intercept);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - 12, py);
    ctx.lineTo(px + 12, py);
    ctx.moveTo(px, py - 12);
    ctx.lineTo(px, py + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.strokeStyle = "#25213b";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#615b75";
    ctx.font = '12px "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = "center";
    [-4, -2, 0, 2, 4].forEach((a) =>
      ctx.fillText(String(a), x(a), height - 18),
    );
    ctx.textAlign = "right";
    [-2, -1, 0, 1, 2].forEach((b) =>
      ctx.fillText(String(b), left - 9, y(b) + 4),
    );
    ctx.textAlign = "right";
    ctx.fillText("斜率 a", width - 20, height - 1);
    ctx.textAlign = "left";
    ctx.fillText("截距 b", 4, 12);
  }, [result, input.slope, input.intercept, width]);
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = weightFromPosition(
      ((event.clientX - bounds.left) / bounds.width) * width,
      ((event.clientY - bounds.top) / bounds.height) * height,
      width,
      height,
    );
    onWeights(next.slope, next.intercept);
  }
  return (
    <div ref={ref} className="loss-landscape">
      <canvas
        ref={canvas}
        style={{ width: "100%", height }}
        role="slider"
        tabIndex={0}
        aria-label="损失地形，拖动标记改变斜率和截距；方向键微调"
        aria-valuemin={-4}
        aria-valuemax={4}
        aria-valuenow={input.slope}
        aria-valuetext={`斜率${input.slope.toFixed(2)}，截距${input.intercept.toFixed(2)}`}
        onKeyDown={(event) => {
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            onWeights(
              bounded(
                input.slope +
                  (event.key === "ArrowRight"
                    ? 0.1
                    : event.key === "ArrowLeft"
                      ? -0.1
                      : 0),
                -4,
                4,
              ),
              bounded(
                input.intercept +
                  (event.key === "ArrowUp"
                    ? 0.1
                    : event.key === "ArrowDown"
                      ? -0.1
                      : 0),
                -2,
                2,
              ),
            );
          }
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          down.current = true;
          onDrag(true);
          move(event);
        }}
        onPointerMove={(event) => {
          if (down.current) move(event);
        }}
        onPointerUp={(event) => {
          if (down.current) {
            move(event);
            down.current = false;
            onDrag(false);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          down.current = false;
          onDrag(false);
        }}
      />
      <p>
        深色代表较大训练误差；等高线连接相同误差。青点为最小二乘解，白色标记可拖动。
      </p>
    </div>
  );
}

export function ErrorContributions({
  result,
  selected,
  onSelect,
}: {
  result: ConceptResult;
  selected: number;
  onSelect: (i: number) => void;
}) {
  const rows = result.linear!.residuals;
  const maximum = Math.max(...rows.map((row) => row.squared), 1e-12);
  return (
    <div className="error-contributions" aria-label="各训练点的平方误差">
      <div
        className="contribution-bars"
        style={rows.length > 24 ? { gap: 2 } : undefined}
      >
        {rows.map((row, i) => (
          <button
            key={i}
            className={i === selected ? "selected" : ""}
            tabIndex={i === selected ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const next = bounded(
                  i + (event.key === "ArrowRight" ? 1 : -1),
                  0,
                  rows.length - 1,
                );
                onSelect(next);
                const buttons =
                  event.currentTarget.parentElement?.querySelectorAll("button");
                (buttons?.[next] as HTMLButtonElement | undefined)?.focus();
              }
            }}
            onClick={() => onSelect(i)}
            aria-label={`选择训练点 ${i + 1}，平方误差 ${conceptNumber(row.squared)}`}
            title={`点${i + 1}：${conceptNumber(row.squared)}`}
          >
            <span
              style={{
                height: `${(row.squared / maximum) * 72}px`,
              }}
            />
            <small>
              {i === selected ||
              (i % Math.ceil(rows.length / 12) === 0 &&
                Math.abs(i - selected) > 1)
                ? i + 1
                : ""}
            </small>
          </button>
        ))}
      </div>
      <p>每根柱的高度是一项 e²；点击柱子定位对应训练点。</p>
    </div>
  );
}

export function ShiftRibbon({
  difference,
  maximum,
}: {
  difference: number[];
  maximum: number;
}) {
  return (
    <svg
      viewBox="0 0 600 25"
      className="shift-ribbon"
      role="img"
      aria-label="横坐标上的预测变化强度，两组共用色标"
    >
      {difference.map((value, i) => (
        <rect
          key={i}
          x={(i / difference.length) * 600}
          y="0"
          width={600 / difference.length + 1}
          height="25"
          fill="var(--blue)"
          fillOpacity={maximum ? Math.abs(value) / maximum : 0}
        />
      ))}
    </svg>
  );
}

export function CoefficientBars({
  weak,
  current,
}: {
  weak: ConceptModel;
  current: ConceptModel;
}) {
  const { ref, width } = useChartWidth();
  const maximum = Math.max(
    ...weak.weights.map(Math.abs),
    ...current.weights.map(Math.abs),
    1e-12,
  );
  const h = 240,
    top = 18,
    bottom = 30,
    left = 57,
    right = 10,
    center = (h - bottom + top) / 2,
    scale = (h - bottom - top) / 2 / maximum;
  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${h}`}
        role="img"
        aria-label="标准化多项式系数：浅紫为弱约束，青色为当前约束，两者共用线性尺度"
      >
        <line
          x1={left}
          x2={width - right}
          y1={center}
          y2={center}
          stroke="#cfc5de"
        />
        {[-maximum, 0, maximum].map((value) => (
          <text
            key={value}
            x={left - 8}
            y={center - value * scale + 4}
            textAnchor="end"
            className="axis-text"
          >
            {value === 0 ? "0" : value.toPrecision(2)}
          </text>
        ))}
        {weak.weights.map((w, i) => {
          const x =
              left + ((i + 0.5) / weak.weights.length) * (width - left - right),
            v = current.weights[i];
          return (
            <g key={i}>
              <title>{`系数 ${i + 1}：弱约束 ${conceptNumber(w)}，当前 ${conceptNumber(v)}`}</title>
              <rect
                x={x - 8}
                y={Math.min(center, center - w * scale)}
                width="7"
                height={Math.abs(w * scale)}
                fill="#b9a3de"
              />
              <rect
                x={x + 1}
                y={Math.min(center, center - v * scale)}
                width="7"
                height={Math.abs(v * scale)}
                fill="var(--teal)"
              />
              {(width > 450 ||
                i % 2 === 0 ||
                i === weak.weights.length - 1) && (
                <text x={x} y={h - 9} className="axis-text" textAnchor="middle">
                  {i + 1}
                </text>
              )}
            </g>
          );
        })}
        <text x={left} y="12" className="axis-label">
          wⱼ
        </text>
      </svg>
      <p className="concept-figure-note">
        系数索引 j；浅紫=弱约束参考，青色=当前α。同一特征基、共用线性尺度。
      </p>
    </div>
  );
}

export function NormPath({
  path,
  alpha,
  onAlpha,
}: {
  path: NonNullable<ConceptResult["regularization"]>["path"];
  alpha: number;
  onAlpha: (v: number) => void;
}) {
  const { ref, width } = useChartWidth();
  const height = 190,
    left = 55,
    right = 20,
    top = 20,
    bottom = 35;
  const maximum = Math.max(...path.map((row) => Math.log1p(row.norm)), 1e-12);
  const x = (a: number) =>
      left + ((Math.log10(a) + 8) / 10) * (width - left - right),
    y = (norm: number) =>
      top + (1 - Math.log1p(norm) / maximum) * (height - top - bottom);
  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="正则化路径：横轴log10 α，纵轴log(1加系数范数)，点击节点调整α"
      >
        {[0, Math.expm1(maximum / 2), Math.expm1(maximum)].map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              stroke="#e6e0ed"
              strokeDasharray="3 5"
            />
            <text
              x={left - 8}
              y={y(value) + 4}
              textAnchor="end"
              className="axis-text"
            >
              {value === 0 ? "0" : value.toPrecision(2)}
            </text>
          </g>
        ))}
        <path
          d={path
            .map((row, i) => `${i ? "L" : "M"}${x(row.alpha)},${y(row.norm)}`)
            .join(" ")}
          fill="none"
          stroke="var(--blue)"
          strokeWidth="2.5"
        />
        {path.map((row, i) => (
          <g
            key={row.alpha}
            role="button"
            tabIndex={0}
            aria-label={`设为α ${alphaText(row.alpha)}，系数范数 ${conceptNumber(row.norm)}`}
            data-alpha={row.alpha}
            onClick={() => onAlpha(row.alpha)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onAlpha(row.alpha);
              }
            }}
            className="norm-node"
          >
            <circle
              cx={x(row.alpha)}
              cy={y(row.norm)}
              r="13"
              fill="transparent"
            />
            <circle
              cx={x(row.alpha)}
              cy={y(row.norm)}
              r={row.alpha === alpha ? 6 : 4}
              fill={row.alpha === alpha ? "var(--teal)" : "var(--blue)"}
              stroke="#fff"
              strokeWidth="2"
            />
            {(i % 2 === 0 || i === path.length - 1) && (
              <text
                x={x(row.alpha)}
                y={height - 10}
                textAnchor="middle"
                className="axis-text"
              >
                {alphaText(row.alpha)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="concept-figure-note">
        横轴α使用对数；纵轴范数‖w‖使用log(1+‖w‖)压缩，刻度为原值。点击节点选择α。
      </p>
    </div>
  );
}
