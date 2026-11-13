"use client";
import { useEffect, useId, useMemo, useRef } from "react";
import {
  boundCurtain,
  canCompareRegions,
  curtainSide,
} from "@/lib/exploration";
import { useChartWidth } from "./useChartWidth";
import {
  classColors,
  classFills,
  type ClassResult,
  type ClassInput,
  type ClassPoint,
} from "@/lib/classification";

export default function ClassificationFigure({
  result,
  input,
  selected,
  onSelect,
  onEdit,
  onDrag,
  reference = null,
  curtain = 0.5,
  onCurtain = () => {},
  hideErrors = false,
  foundRows = [],
  allowTrainingDrag = true,
  large = false,
}: {
  result: ClassResult;
  input: ClassInput;
  selected: number | null;
  onSelect: (id: number) => void;
  onEdit: (id: number, x: number, y: number) => void;
  onDrag: (v: boolean) => void;
  reference?: ClassResult | null;
  curtain?: number;
  onCurtain?: (value: number) => void;
  hideErrors?: boolean;
  foundRows?: number[];
  allowTrainingDrag?: boolean;
  large?: boolean;
}) {
  const { ref, width } = useChartWidth();
  const canvas = useRef<HTMLCanvasElement>(null),
    referenceCanvas = useRef<HTMLCanvasElement>(null),
    svg = useRef<SVGSVGElement>(null),
    active = useRef<number | null>(null);
  const dividerDown = useRef(false);
  const baseline = canCompareRegions(reference, result) ? reference : null;
  const referencePoints = useMemo(
    () =>
      new Map(
        [...(baseline?.training || []), ...(baseline?.validation || [])].map(
          (p) => [p.row, p],
        ),
      ),
    [baseline],
  );
  const id = useId().replace(/:/g, "");
  const height = width < 450 ? 310 : large ? 500 : 370,
    left = 55,
    right = 18,
    top = 20,
    bottom = 47,
    w = width - left - right,
    h = height - top - bottom;
  const [xmin, xmax, ymin, ymax] = result.region.bounds;
  const x = (n: number) => left + ((n - xmin) / (xmax - xmin)) * w,
    y = (n: number) => top + ((ymax - n) / (ymax - ymin)) * h;
  const compatible = ["dataset", "seed", "noise", "fraction"].every(
    (k) =>
      input[k as keyof ClassInput] === result.parameters[k as keyof ClassInput],
  );
  useEffect(() => {
    function draw(el: HTMLCanvasElement | null, data: ClassResult) {
      if (!el) return;
      const ratio = window.devicePixelRatio || 1;
      el.width = Math.round(width * ratio);
      el.height = Math.round(height * ratio);
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const { columns, rows, labels } = data.region;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < columns; c++) {
          ctx.fillStyle = classFills[labels[r * columns + c]];
          ctx.fillRect(
            left + (c * w) / columns,
            top + (r * h) / rows,
            w / columns + 0.3,
            h / rows + 0.3,
          );
          ctx.strokeStyle = "#48395540";
          ctx.lineWidth = 0.7;
          if (
            c < columns - 1 &&
            labels[r * columns + c] !== labels[r * columns + c + 1]
          ) {
            ctx.beginPath();
            ctx.moveTo(left + ((c + 1) * w) / columns, top + (r * h) / rows);
            ctx.lineTo(
              left + ((c + 1) * w) / columns,
              top + ((r + 1) * h) / rows,
            );
            ctx.stroke();
          }
          if (
            r < rows - 1 &&
            labels[r * columns + c] !== labels[(r + 1) * columns + c]
          ) {
            ctx.beginPath();
            ctx.moveTo(left + (c * w) / columns, top + ((r + 1) * h) / rows);
            ctx.lineTo(
              left + ((c + 1) * w) / columns,
              top + ((r + 1) * h) / rows,
            );
            ctx.stroke();
          }
        }
    }
    draw(canvas.current, result);
    if (baseline) draw(referenceCanvas.current, baseline);
  }, [result, baseline, width, height, w, h]);
  function moveDivider(clientX: number) {
    const box = svg.current!.getBoundingClientRect();
    onCurtain(
      boundCurtain((((clientX - box.left) * width) / box.width - left) / w),
    );
  }
  function move(clientX: number, clientY: number, row: number) {
    const box = svg.current!.getBoundingClientRect();
    onEdit(
      row,
      xmin +
        ((((clientX - box.left) * width) / box.width - left) / w) *
          (xmax - xmin),
      ymax -
        ((((clientY - box.top) * height) / box.height - top) / h) *
          (ymax - ymin),
    );
  }
  function point(p: ClassPoint, training: boolean, index: number) {
    const side = baseline
      ? curtainSide(p.x, result.region.bounds, curtain)
      : "B";
    const shown = side === "A" ? referencePoints.get(p.row) || p : p;
    const edit =
      compatible && training
        ? input.edits.find((e) => e.row === p.row)
        : undefined;
    const px = x(edit?.x ?? p.x),
      py = y(edit?.y ?? p.y),
      color = classColors[p.label];
    const draggable = training && result.dataset.synthetic && allowTrainingDrag;
    const label = `${training ? "训练" : "验证"}点 ${p.row + 1}，真实${result.dataset.classes[p.label]}，${baseline ? side + "区域" : ""}预测${result.dataset.classes[shown.prediction]}${draggable ? "，可拖动或方向键移动" : ""}`;
    return (
      <g
        key={`${training ? "t" : "v"}${p.row}`}
        role={draggable ? "slider" : "button"}
        aria-label={label}
        aria-valuemin={draggable ? -3 : undefined}
        aria-valuemax={draggable ? 3 : undefined}
        aria-valuenow={draggable ? (edit?.x ?? p.x) : undefined}
        aria-valuetext={
          draggable
            ? `x ${(edit?.x ?? p.x).toFixed(2)}，y ${(edit?.y ?? p.y).toFixed(2)}`
            : undefined
        }
        tabIndex={
          p.row === selected || (selected === null && index === 0) ? 0 : -1
        }
        data-class-row={p.row}
        data-split={training ? "training" : "validation"}
        className={draggable ? "class-point draggable" : "class-point"}
        onClick={() => onSelect(p.row)}
        onKeyDown={(e) => {
          if (["Enter", " "].includes(e.key)) {
            e.preventDefault();
            onSelect(p.row);
          }
          if (
            draggable &&
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          ) {
            e.preventDefault();
            onSelect(p.row);
            const step = e.shiftKey ? 0.2 : 0.05;
            onEdit(
              p.row,
              (edit?.x ?? p.x) +
                (e.key === "ArrowRight"
                  ? step
                  : e.key === "ArrowLeft"
                    ? -step
                    : 0),
              (edit?.y ?? p.y) +
                (e.key === "ArrowUp"
                  ? step
                  : e.key === "ArrowDown"
                    ? -step
                    : 0),
            );
          }
        }}
        onPointerDown={(e) => {
          onSelect(p.row);
          if (draggable) {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            active.current = p.row;
            onDrag(true);
          }
        }}
        onPointerMove={(e) => {
          if (active.current === p.row) move(e.clientX, e.clientY, p.row);
        }}
        onPointerUp={(e) => {
          if (active.current === p.row) {
            move(e.clientX, e.clientY, p.row);
            active.current = null;
            onDrag(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => {
          active.current = null;
          onDrag(false);
        }}
        onLostPointerCapture={() => {
          active.current = null;
          onDrag(false);
        }}
      >
        <circle cx={px} cy={py} r="10" fill="transparent" />
        {selected === p.row && (
          <circle
            cx={px}
            cy={py}
            r="11"
            fill="none"
            stroke="#28213b"
            strokeWidth="2"
          />
        )}
        {p.label === 0 ? (
          <circle
            cx={px}
            cy={py}
            r="4.6"
            fill={training ? color : "#fff"}
            stroke={color}
            strokeWidth="1.5"
          />
        ) : p.label === 1 ? (
          <path
            d={`M${px},${py - 5.3}L${px + 5.3},${py + 4.2}L${px - 5.3},${py + 4.2}Z`}
            fill={training ? color : "#fff"}
            stroke={color}
            strokeWidth="1.3"
          />
        ) : (
          <rect
            x={px - 4.5}
            y={py - 4.5}
            width="9"
            height="9"
            fill={training ? color : "#fff"}
            stroke={color}
            strokeWidth="1.5"
          />
        )}
        {!training &&
          !shown.correct &&
          (!hideErrors || foundRows.includes(p.row)) && (
            <path
              d={`M${px - 3},${py - 3}L${px + 3},${py + 3}M${px + 3},${py - 3}L${px - 3},${py + 3}`}
              stroke="#201b28"
              strokeWidth="1.7"
            />
          )}
      </g>
    );
  }
  const clipped = [...result.training, ...result.validation].some(
    (p) => p.x < xmin || p.x > xmax || p.y < ymin || p.y > ymax,
  );
  return (
    <div ref={ref} className="classification-figure">
      <canvas ref={canvas} aria-hidden="true" />
      {baseline && (
        <canvas
          ref={referenceCanvas}
          aria-hidden="true"
          style={{
            clipPath: `inset(0 ${100 * (1 - (left + w * boundCurtain(curtain)) / width)}% 0 0)`,
          }}
        />
      )}
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="分类决策区域与训练验证样本"
      >
        <defs>
          <clipPath id={id}>
            <rect x={left} y={top} width={w} height={h} />
          </clipPath>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={left + t * w}
              x2={left + t * w}
              y1={top}
              y2={height - bottom}
              stroke="#ffffff88"
            />
            <line
              x1={left}
              x2={width - right}
              y1={top + t * h}
              y2={top + t * h}
              stroke="#ffffff88"
            />
            <text
              x={left + t * w}
              y={height - bottom + 20}
              textAnchor="middle"
              className="axis-text"
            >
              {(xmin + t * (xmax - xmin)).toFixed(1)}
            </text>
            <text
              x={left - 8}
              y={top + t * h + 4}
              textAnchor="end"
              className="axis-text"
            >
              {(ymax - t * (ymax - ymin)).toFixed(1)}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${id})`}>
          {result.training.map((p, i) => point(p, true, i))}
          {result.validation.map((p, i) => point(p, false, i))}
        </g>
        {baseline && (
          <g
            className="curtain-handle"
            role="slider"
            tabIndex={0}
            aria-label="A/B边界对照位置"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(curtain * 100)}
            aria-valuetext={`A显示左侧${Math.round(curtain * 100)}%，B显示其余区域`}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                onCurtain(
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 1
                      : boundCurtain(
                          curtain + (e.key === "ArrowRight" ? 0.05 : -0.05),
                        ),
                );
              }
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              dividerDown.current = true;
              moveDivider(e.clientX);
            }}
            onPointerMove={(e) => {
              if (dividerDown.current) moveDivider(e.clientX);
            }}
            onPointerUp={(e) => {
              if (dividerDown.current) {
                moveDivider(e.clientX);
                dividerDown.current = false;
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onPointerCancel={() => {
              dividerDown.current = false;
            }}
            onLostPointerCapture={() => {
              dividerDown.current = false;
            }}
          >
            <line
              x1={left + w * curtain}
              x2={left + w * curtain}
              y1={top}
              y2={height - bottom}
              stroke="transparent"
              strokeWidth="30"
            />
            <line
              x1={left + w * curtain}
              x2={left + w * curtain}
              y1={top}
              y2={height - bottom}
              stroke="#28213d"
              strokeWidth="2"
            />
            <circle
              cx={left + w * curtain}
              cy={top + h / 2}
              r="15"
              fill="#fff"
              stroke="#28213d"
              strokeWidth="2"
            />
            <path
              d={`M${left + w * curtain - 4},${top + h / 2 - 6}v12M${left + w * curtain + 4},${top + h / 2 - 6}v12`}
              stroke="#28213d"
              strokeWidth="1.5"
            />
            {curtain > 0.35 && (
              <text x={left + 10} y={top + 20} className="curtain-label">
                A · {baseline.model_name}
              </text>
            )}
            {curtain < 0.65 && (
              <text
                x={width - right - 10}
                y={top + 20}
                textAnchor="end"
                className="curtain-label"
              >
                B · {result.model_name}
              </text>
            )}
          </g>
        )}
        <text
          x={width - right}
          y={height - 1}
          textAnchor="end"
          className="axis-label"
        >
          {result.dataset.features[0]}
        </text>
        <text x={left} y="12" className="axis-label">
          {result.dataset.features[1]}
        </text>
      </svg>
      {clipped && (
        <p className="concept-clip">
          部分样本超出视窗，准确率仍按完整划分计算。
        </p>
      )}
    </div>
  );
}
