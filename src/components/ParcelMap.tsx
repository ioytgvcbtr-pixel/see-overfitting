"use client";
import { useEffect, useRef } from "react";
import {
  classColors,
  classFills,
  type ClassPoint,
  type ClassResult,
} from "@/lib/classification";

export default function ParcelMap({
  result,
  point,
}: {
  result: ClassResult;
  point: ClassPoint;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const { columns, rows, labels, bounds } = result.region,
      w = 180,
      h = 130;
    canvas.current!.width = w * 2;
    canvas.current!.height = h * 2;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        ctx.fillStyle = classFills[labels[r * columns + c]];
        ctx.fillRect(
          (c * w) / columns,
          (r * h) / rows,
          w / columns + 0.4,
          h / rows + 0.4,
        );
      }
    const x = (n: number) => ((n - bounds[0]) / (bounds[1] - bounds[0])) * w,
      y = (n: number) => ((bounds[3] - n) / (bounds[3] - bounds[2])) * h;
    for (const p of result.training) {
      ctx.fillStyle = classColors[p.label];
      ctx.beginPath();
      ctx.arc(x(p.x), y(p.y), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x(point.x), y(point.y), 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fff9e8";
    ctx.fill();
    ctx.strokeStyle = "#352449";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x(point.x) - 9, y(point.y));
    ctx.lineTo(x(point.x) + 9, y(point.y));
    ctx.moveTo(x(point.x), y(point.y) - 9);
    ctx.lineTo(x(point.x), y(point.y) + 9);
    ctx.strokeStyle = "#352449";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [result, point]);
  return (
    <div className="forest-sample-tag">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`当前模型区域与包裹位置，横坐标${point.x.toFixed(3)}，纵坐标${point.y.toFixed(3)}`}
      />
      <div>
        <strong>包裹标签 · 点{point.row + 1}</strong>
        <span>
          {result.dataset.features[0]} = {point.x.toFixed(3)}
        </span>
        <span>
          {result.dataset.features[1]} = {point.y.toFixed(3)}
        </span>
        <small>
          小地图底色为模型区域，圆环是包裹位置。先看位置，再判断投递门。格心近似与原样本判断可能在边缘不同。
        </small>
      </div>
    </div>
  );
}
