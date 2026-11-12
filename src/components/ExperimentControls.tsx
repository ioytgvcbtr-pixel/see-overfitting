"use client";
import { RotateCcw, Settings2 } from "lucide-react";
import type { Parameters } from "@/lib/experiment";
type NumericKey = "degree" | "samples" | "noise" | "alpha" | "seed";
const alphas = [1e-8, 1e-6, 1e-4, 0.01, 0.1, 1, 10, 100];

export default function ExperimentControls({
  params,
  onChange,
  onReset,
}: {
  params: Parameters;
  onChange: (key: NumericKey, value: number) => void;
  onReset: () => void;
}) {
  const controls = {
    degree: (
      <Slider
        label="模型复杂度"
        hint="多项式阶数越高，能拟合的形状越复杂。"
        value={params.degree}
        display={`${params.degree} 阶`}
        min={1}
        max={15}
        step={1}
        onChange={(v) => onChange("degree", v)}
        left="简单"
        right="复杂"
      />
    ),
    samples: (
      <Slider
        label="训练样本量"
        hint="验证数据保持不变，只增加用于学习的样本。"
        value={params.samples}
        display={`${params.samples} 个`}
        min={12}
        max={160}
        step={1}
        onChange={(v) => onChange("samples", v)}
        left="12 个"
        right="160 个"
      />
    ),
    noise: (
      <Slider
        label="噪声水平"
        hint="噪声越大，数据点偏离规律的程度越大。"
        value={params.noise}
        display={params.noise.toFixed(2)}
        min={0}
        max={0.6}
        step={0.01}
        onChange={(v) => onChange("noise", v)}
        left="无噪声"
        right="更多噪声"
      />
    ),
    alpha: (
      <Slider
        label="正则化强度"
        hint="约束模型系数；过强的约束也可能限制拟合。"
        value={Math.max(0, alphas.indexOf(params.alpha))}
        display={
          params.alpha < 0.001
            ? params.alpha.toExponential(0)
            : String(params.alpha)
        }
        min={0}
        max={7}
        step={1}
        onChange={(v) => onChange("alpha", alphas[v])}
        left="弱约束"
        right="强约束"
      />
    ),
  };
  const primary =
    params.scene === "samples"
      ? (["samples", "noise"] as const)
      : params.scene === "regularization"
        ? (["alpha"] as const)
        : (["degree"] as const);
  const advanced = (["degree", "samples", "noise", "alpha"] as const).filter(
    (key) => !primary.some((item) => item === key),
  );
  return (
    <section className="panel parameters-panel">
      <div className="panel-heading compact">
        <h2>
          <Settings2 size={18} />
          动手调整
        </h2>
        <button
          className="icon-button"
          aria-label="重置当前实验参数"
          title="重置当前课程参数"
          onClick={onReset}
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <div className="parameter-controls">
        {primary.map((key) => (
          <div key={key}>{controls[key]}</div>
        ))}
        <p className="parameter-reading">
          一次只改一个条件，再看验证误差怎样变化。
        </p>
        <details className="advanced-controls" key={params.scene}>
          <summary>更多实验条件</summary>
          <div>
            {advanced.map((key) => (
              <div key={key}>{controls[key]}</div>
            ))}
            <label className="seed-row">
              随机种子
              <input
                aria-label="随机种子"
                type="number"
                min={0}
                max={999999}
                value={params.seed}
                onChange={(e) =>
                  onChange(
                    "seed",
                    Math.max(
                      0,
                      Math.min(999999, Math.trunc(Number(e.target.value) || 0)),
                    ),
                  )
                }
              />
            </label>
            <p className="control-hint">
              种子相同可重现同一批数据。修改其他条件会开启新一轮对照。
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}

function Slider({
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  onChange,
  left,
  right,
}: {
  label: string;
  hint: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  left: string;
  right: string;
}) {
  return (
    <div className="slider-control">
      <div className="slider-title">
        <label>{label}</label>
        <output>{display}</output>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={
          {
            "--range-fill": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="slider-extents">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <p className="control-hint">{hint}</p>
    </div>
  );
}
