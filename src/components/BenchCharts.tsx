"use client";
import { useEffect, useState } from "react";
import type { BenchResult, Learning, Prediction } from "@/lib/bench";
import { number } from "@/lib/bench";
import { useChartWidth } from "./useChartWidth";

function domain(values: number[]) {
  const minimum = Math.min(...values),
    maximum = Math.max(...values);
  const pad = Math.max((maximum - minimum) * 0.1, 0.01);
  return [minimum - pad, maximum + pad];
}
function tick(value: number) {
  return Math.abs(value) >= 1000
    ? value.toPrecision(3)
    : Number(value.toPrecision(3)).toString();
}

export function PredictionChart({
  result,
  mode,
  feature,
  showTraining,
}: {
  result: BenchResult;
  mode: "parity" | "residual" | "feature";
  feature: number;
  showTraining: boolean;
}) {
  const { ref, width } = useChartWidth();
  const height = width < 500 ? 285 : 300;
  const left = 55,
    right = 20,
    top = 20,
    bottom = 48;
  const [active, setActive] = useState<{
    point: Prediction;
    training: boolean;
  } | null>(null);
  useEffect(() => setActive(null), [result.fingerprint, mode, feature]);
  const points = [
    ...result.validation_predictions.map((point) => ({
      point,
      training: false,
    })),
    ...(showTraining
      ? result.training_predictions.map((point) => ({ point, training: true }))
      : []),
  ];
  const getX = (p: Prediction) =>
    mode === "parity"
      ? p.actual
      : mode === "residual"
        ? p.prediction
        : p.features[feature];
  const getY = (p: Prediction) =>
    mode === "residual"
      ? p.residual
      : mode === "feature"
        ? p.actual
        : p.prediction;
  let xd = domain(points.map((p) => getX(p.point))),
    yd = domain(points.map((p) => getY(p.point)));
  if (mode === "parity") {
    const limits = domain(
      points.flatMap((p) => [p.point.actual, p.point.prediction]),
    );
    xd = limits;
    yd = limits;
  }
  if (mode === "residual") {
    const max =
      Math.max(...points.map((p) => Math.abs(p.point.residual)), 0.1) * 1.15;
    yd = [-max, max];
  }
  const x = (value: number) =>
    left + ((value - xd[0]) / (xd[1] - xd[0])) * (width - left - right);
  const y = (value: number) =>
    top + ((yd[1] - value) / (yd[1] - yd[0])) * (height - top - bottom);
  const xLabel =
    mode === "parity"
      ? `真实值（${result.dataset.unit}）`
      : mode === "residual"
        ? `预测值（${result.dataset.unit}）`
        : result.dataset.features[feature];
  const yLabel =
    mode === "residual"
      ? "残差：真实−预测"
      : mode === "feature"
        ? result.dataset.target
        : "预测值";
  return (
    <div ref={ref} className="bench-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${xLabel}与${yLabel}散点图`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const xv = xd[0] + f * (xd[1] - xd[0]),
            yv = yd[0] + f * (yd[1] - yd[0]);
          return (
            <g key={f}>
              <line
                x1={x(xv)}
                x2={x(xv)}
                y1={top}
                y2={height - bottom}
                stroke="#eef1f7"
              />
              <line
                x1={left}
                x2={width - right}
                y1={y(yv)}
                y2={y(yv)}
                stroke="#e9edf5"
                strokeDasharray="3 5"
              />
              <text
                x={x(xv)}
                y={height - bottom + 20}
                textAnchor="middle"
                className="bench-axis"
              >
                {tick(xv)}
              </text>
              <text
                x={left - 10}
                y={y(yv) + 4}
                textAnchor="end"
                className="bench-axis"
              >
                {tick(yv)}
              </text>
            </g>
          );
        })}
        {mode === "parity" && (
          <line
            x1={x(xd[0])}
            y1={y(xd[0])}
            x2={x(xd[1])}
            y2={y(xd[1])}
            stroke="#738399"
            strokeDasharray="5 5"
          />
        )}
        {mode === "residual" && (
          <line
            x1={left}
            x2={width - right}
            y1={y(0)}
            y2={y(0)}
            stroke="#738399"
            strokeDasharray="5 5"
          />
        )}
        {points.map(({ point, training }) => {
          const common = {
            fill: training ? "var(--teal)" : "var(--coral)",
            fillOpacity: 0.82,
            stroke: "white",
            strokeWidth: 0.6,
            onMouseEnter: () => setActive({ point, training }),
            onClick: () => setActive({ point, training }),
          };
          return training ? (
            <circle
              key={`t-${point.row}`}
              cx={x(getX(point))}
              cy={y(getY(point))}
              r={width < 500 ? 3 : 3.6}
              {...common}
            >
              <title>{`训练样本${point.row}：真实${number(point.actual)}，预测${number(point.prediction)}`}</title>
            </circle>
          ) : (
            <rect
              key={`v-${point.row}`}
              x={x(getX(point)) - 3}
              y={y(getY(point)) - 3}
              width="6"
              height="6"
              rx=".6"
              {...common}
            >
              <title>{`验证样本${point.row}：真实${number(point.actual)}，预测${number(point.prediction)}`}</title>
            </rect>
          );
        })}
        <text x={left} y="12" className="bench-axis-label">
          {yLabel}
        </text>
        <text
          x={width - right}
          y={height - 5}
          textAnchor="end"
          className="bench-axis-label"
        >
          {xLabel}
        </text>
      </svg>
      {active && (
        <div className="bench-chart-tooltip">
          <strong>
            {active.training ? "训练" : "验证"}样本 #{active.point.row}
          </strong>
          <span>真实 {number(active.point.actual)}</span>
          <span>预测 {number(active.point.prediction)}</span>
          <span>残差 {number(active.point.residual)}</span>
        </div>
      )}
      <div className="bench-legend">
        <span>
          <i className="dot validation-marker" />
          验证数据（{result.validation_predictions.length}点）
        </span>
        {showTraining && (
          <span>
            <i className="dot teal" />
            训练数据（最多200点）
          </span>
        )}
        <span>
          {mode === "parity"
            ? "虚线表示预测=真实"
            : mode === "residual"
              ? "虚线为零误差"
              : "特征关系用于探索，不表示因果"}
        </span>
      </div>
    </div>
  );
}

export function LearningChart({
  data,
  unit,
}: {
  data: Learning;
  unit: string;
}) {
  const { ref, width } = useChartWidth();
  const height = width < 500 ? 280 : 300;
  const left = 55,
    right = 22,
    top = 24,
    bottom = 47;
  const max =
    Math.max(
      ...data.points.flatMap((p) => [p.train_rmse, p.validation_rmse]),
      0.1,
    ) * 1.15;
  const minX = data.points[0].samples,
    maxX = data.points[data.points.length - 1].samples;
  const x = (v: number) =>
      left + ((v - minX) / (maxX - minX)) * (width - left - right),
    y = (v: number) => top + (1 - v / max) * (height - top - bottom);
  const path = (key: "train_rmse" | "validation_rmse") =>
    data.points
      .map((p, i) => `${i ? "L" : "M"}${x(p.samples)},${y(p[key])}`)
      .join(" ");
  return (
    <div ref={ref} className="bench-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="训练样本量与训练、验证RMSE的学习曲线"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={left}
              x2={width - right}
              y1={y(f * max)}
              y2={y(f * max)}
              stroke="#e9edf5"
              strokeDasharray="3 5"
            />
            <text
              x={left - 9}
              y={y(f * max) + 4}
              textAnchor="end"
              className="bench-axis"
            >
              {tick(f * max)}
            </text>
          </g>
        ))}
        {(["train_rmse", "validation_rmse"] as const).map((key, index) => (
          <g key={key}>
            <path
              d={path(key)}
              stroke={index ? "var(--coral)" : "var(--teal)"}
              strokeWidth="2.5"
              fill="none"
            />
            {data.points.map((p) => (
              <circle
                key={p.samples}
                cx={x(p.samples)}
                cy={y(p[key])}
                r="4"
                fill={index ? "var(--coral)" : "var(--teal)"}
                stroke="white"
                strokeWidth="1.5"
              >
                <title>{`${p.samples}样本：${number(p[key])}${unit}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {data.points.map((p) => (
          <text
            key={p.samples}
            x={x(p.samples)}
            y={height - bottom + 20}
            textAnchor="middle"
            className="bench-axis"
          >
            {p.samples}
          </text>
        ))}
        <text x={left} y="13" className="bench-axis-label">
          RMSE（{unit}）
        </text>
        <text
          x={width - right}
          y={height - 4}
          textAnchor="end"
          className="bench-axis-label"
        >
          训练样本数
        </text>
      </svg>
      <div className="bench-legend">
        <span>
          <i className="dot teal" />
          训练RMSE
        </span>
        <span>
          <i className="dot coral" />
          验证RMSE
        </span>
        <span>模型参数和验证集保持不变</span>
      </div>
    </div>
  );
}
