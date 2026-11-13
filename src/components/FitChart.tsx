"use client";
import { useId, useState } from "react";
import type { Result, Sweep } from "@/lib/experiment";
import { useChartWidth } from "./useChartWidth";

export function FitChart({ result }: { result: Result | null }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [showTruth, setShowTruth] = useState(true);
  const { ref, width } = useChartWidth();
  const height = width < 500 ? 260 : 280,
    left = 49,
    right = 23,
    top = 18,
    bottom = 43;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const x = (v: number) => left + v * plotWidth;
  const y = (v: number) => top + ((1.7 - v) / 3.4) * plotHeight;
  const curve = result?.curve || [];
  const path = (key: "fit" | "truth") =>
    curve
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${x(p.x).toFixed(2)},${y(Math.max(-100, Math.min(100, p[key]))).toFixed(2)}`,
      )
      .join(" ");
  const clipped =
    curve.some((p) => p.fit < -1.7 || p.fit > 1.7) ||
    [...(result?.train || []), ...(result?.validation || [])].some(
      (p) => p.y < -1.7 || p.y > 1.7,
    );
  const selected = hover === null ? null : curve[hover];
  return (
    <div ref={ref} className="fit-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="拟合曲线：青色圆点为训练样本，珊瑚色方块为验证样本，紫线为模型，灰色虚线为真实函数"
      >
        <defs>
          <clipPath id={id}>
            <rect x={left} y={top} width={plotWidth} height={plotHeight} />
          </clipPath>
        </defs>
        {[-1.5, -0.75, 0, 0.75, 1.5].map((v) => (
          <g key={v}>
            <line
              x1={left}
              x2={width - right}
              y1={y(v)}
              y2={y(v)}
              stroke="#e9ecf2"
              strokeDasharray={v === 0 ? "0" : "3 5"}
            />
            <text
              x={left - 14}
              y={y(v) + 4}
              textAnchor="end"
              className="axis-text"
            >
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
          <g key={v}>
            <line
              x1={x(v)}
              x2={x(v)}
              y1={top}
              y2={height - bottom}
              stroke="#f0f2f6"
            />
            <text
              x={x(v)}
              y={height - bottom + 23}
              textAnchor="middle"
              className="axis-text"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${id})`}>
          {showTruth && (
            <path
              d={path("truth")}
              fill="none"
              stroke="#738399"
              strokeWidth="2"
              strokeDasharray="5 6"
            />
          )}
          {result?.validation.map((p, i) => (
            <rect
              key={`v${i}`}
              x={x(p.x) - 3}
              y={y(p.y) - 3}
              width="6"
              height="6"
              rx=".7"
              fill="#fff3ed"
              stroke="var(--coral)"
              strokeWidth="1.3"
            />
          ))}
          {result?.train.map((p, i) => (
            <circle
              key={i}
              cx={x(p.x)}
              cy={y(p.y)}
              r="4.6"
              fill="var(--teal)"
              fillOpacity=".86"
              stroke="white"
              strokeWidth="1.4"
            />
          ))}
          <path
            d={path("fit")}
            fill="none"
            stroke="var(--blue)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {selected && (
            <>
              <line
                x1={x(selected.x)}
                x2={x(selected.x)}
                y1={top}
                y2={height - bottom}
                stroke="var(--blue)"
                strokeDasharray="3 4"
              />
              <circle
                cx={x(selected.x)}
                cy={y(selected.fit)}
                r="5"
                fill="var(--blue)"
                stroke="white"
                strokeWidth="2"
              />
            </>
          )}
        </g>
        <text
          x={width - right}
          y={height - 4}
          textAnchor="end"
          className="axis-label"
        >
          输入特征 x
        </text>
        <text x="15" y="17" className="axis-label">
          y
        </text>
        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setHover(
              Math.max(
                0,
                Math.min(
                  curve.length - 1,
                  Math.round(
                    ((event.clientX - bounds.left) / bounds.width) *
                      (curve.length - 1),
                  ),
                ),
              ),
            );
          }}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {selected && (
        <div className="chart-tooltip">
          x {selected.x.toFixed(2)}
          <span>预测 {selected.fit.toFixed(3)}</span>
          <span>真实 {selected.truth.toFixed(3)}</span>
        </div>
      )}
      <div className="chart-legend">
        <span>
          <i className="dot teal" />
          训练样本
        </span>
        <span>
          <i className="dot coral" />
          验证样本
        </span>
        <span>
          <i className="line blue" />
          模型拟合
        </span>
        <button
          className={!showTruth ? "muted" : ""}
          onClick={() => setShowTruth(!showTruth)}
        >
          <i className="line dashed" />
          真实函数
        </button>
      </div>
      {clipped && (
        <p className="clipping-note">
          曲线超出当前纵轴范围，部分极值已裁切；误差仍由完整预测计算。
        </p>
      )}
    </div>
  );
}

export function ErrorChart({
  data,
  current,
}: {
  data: Sweep;
  current: number;
}) {
  const { ref, width } = useChartWidth();
  const height = 230,
    left = 60,
    top = 20,
    pw = width - left - 18,
    ph = height - top - 36;
  const values = data.points.flatMap((p) => [p.train_mse, p.validation_mse]);
  const positives = values.filter((value) => value > 0);
  const zeroFloor = positives.length
    ? Math.max(Math.min(...positives) / 2, Number.MIN_VALUE)
    : 1e-16;
  const logarithm = (value: number) =>
    Math.log10(value > 0 ? value : zeroFloor);
  const low = Math.min(...values.map(logarithm)) - 0.15;
  const high = Math.max(...values.map(logarithm)) + 0.15;
  const x = (degree: number) => left + ((degree - 1) / 14) * pw;
  const y = (value: number) =>
    top + ((high - logarithm(value)) / (high - low)) * ph;
  const path = (key: "train_mse" | "validation_mse") =>
    data.points
      .map((p, i) => `${i ? "L" : "M"}${x(p.degree)},${y(p[key])}`)
      .join(" ");
  return (
    <div ref={ref}>
      <svg
        className="error-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="不同模型阶数的训练与验证误差，纵轴为对数尺度"
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={left}
              x2={left + pw}
              y1={top + f * ph}
              y2={top + f * ph}
              stroke="#e9ecf2"
            />
            <text
              x={left - 9}
              y={top + f * ph + 4}
              textAnchor="end"
              className="axis-text"
            >
              {Math.pow(10, high - f * (high - low)).toPrecision(1)}
            </text>
          </g>
        ))}
        <line
          x1={x(current)}
          x2={x(current)}
          y1={top}
          y2={top + ph}
          stroke="#b9bfea"
          strokeDasharray="4 4"
        />
        <path
          d={path("train_mse")}
          stroke="var(--teal)"
          strokeWidth="2"
          fill="none"
        />
        <path
          d={path("validation_mse")}
          stroke="var(--coral)"
          strokeWidth="2.5"
          fill="none"
        />
        {data.points.map((p) => (
          <g key={p.degree}>
            <circle
              cx={x(p.degree)}
              cy={y(p.validation_mse)}
              r={p.degree === current ? 4 : 2.5}
              fill="var(--coral)"
            />
            {(width > 550 || [1, 4, 8, 12, 15].includes(p.degree)) && (
              <text
                x={x(p.degree)}
                y={height - 11}
                textAnchor="middle"
                className="axis-text"
              >
                {p.degree}
              </text>
            )}
          </g>
        ))}
      </svg>
      {values.includes(0) && (
        <p className="small-copy muted">零误差显示在对数轴下沿。</p>
      )}
    </div>
  );
}
