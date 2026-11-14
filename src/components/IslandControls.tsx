"use client";
import { useRef, type PointerEvent, type KeyboardEvent } from "react";
import { bounded } from "@/lib/concepts";
import { railValue, dialIndex } from "@/lib/island-experiments";

export function SceneRange({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="island-range">
      <span>
        {label}
        <output>{display}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export function SceneHandle({
  label,
  value,
  min,
  max,
  step = 0.05,
  x,
  y,
  start,
  end,
  axis = "y",
  onChange,
  onDrag,
  children,
  dial,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  x: number;
  y: number;
  start: number;
  end: number;
  axis?: "x" | "y";
  onChange: (v: number) => void;
  onDrag: (v: boolean) => void;
  children: React.ReactNode;
  dial?: boolean;
}) {
  const active = useRef<number | null>(null);
  function move(e: PointerEvent<SVGGElement>) {
    const svg = e.currentTarget.ownerSVGElement!,
      rect = svg.getBoundingClientRect(),
      view = svg.viewBox.baseVal;
    const px = ((e.clientX - rect.left) / rect.width) * view.width,
      py = ((e.clientY - rect.top) / rect.height) * view.height;
    if (dial && Math.hypot(px - x, py - y) < 12) return;
    onChange(
      dial
        ? dialIndex(px, py, x, y)
        : railValue(axis === "x" ? px : py, start, end, min, max, step),
    );
  }
  function key(e: KeyboardEvent<SVGGElement>) {
    const d =
      e.key === "ArrowUp" || e.key === "ArrowRight"
        ? step
        : e.key === "ArrowDown" || e.key === "ArrowLeft"
          ? -step
          : 0;
    if (d || ["Home", "End", "PageUp", "PageDown"].includes(e.key)) {
      e.preventDefault();
      onChange(
        e.key === "Home"
          ? min
          : e.key === "End"
            ? max
            : bounded(
                value +
                  (e.key === "PageUp"
                    ? step * 5
                    : e.key === "PageDown"
                      ? -step * 5
                      : d),
                min,
                max,
              ),
      );
    }
  }
  return (
    <g
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-orientation={dial || axis === "x" ? "horizontal" : "vertical"}
      className="island-handle"
      onKeyDown={key}
      onPointerDown={(e) => {
        e.preventDefault();
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        onDrag(true);
        if (dial) move(e);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) move(e);
      }}
      onPointerUp={(e) => {
        if (active.current === e.pointerId) {
          move(e);
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
      onBlur={() => {
        active.current = null;
        onDrag(false);
      }}
    >
      <circle cx={x} cy={y} r={dial ? 47 : 23} fill="transparent" />
      {children}
      <circle
        className="handle-focus-ring"
        cx={x}
        cy={y}
        r={dial ? 50 : 25}
        fill="none"
        strokeWidth="3"
      />
    </g>
  );
}

export function LittleTree({
  x,
  y,
  scale = 1,
}: {
  x: number;
  y: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} aria-hidden="true">
      <path
        d="M0 10V-23"
        stroke="#88725c"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <ellipse cy="-27" rx="22" ry="18" fill="#9ebd93" />
      <ellipse cx="-13" cy="-23" rx="13" ry="13" fill="#b2cca5" />
      <ellipse cx="8" cy="-33" rx="14" ry="12" fill="#c7d7b2" />
    </g>
  );
}
