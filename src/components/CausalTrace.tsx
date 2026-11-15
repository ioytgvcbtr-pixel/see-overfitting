"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ScanLine } from "lucide-react";
import { inputKey, proofNumber, type IslandId, type IslandInput } from "@/lib/island-learning";

const labels: Record<string, string> = { slope:"船帆斜率", intercept:"船身截距", alpha:"正则化α", degree:"多项式阶数", model:"分类模型", depth:"树深", edits:"训练点位置", c:"C", gamma:"γ", neighbors:"邻居数" };
export default function CausalTrace({ panel, input, calculated, pending, value, metric, onLocate }: {
  panel: IslandId; input: IslandInput; calculated: IslandInput; pending: boolean;
  value: number; metric: string; onLocate: () => void;
}) {
  const previous = useRef<{ input: IslandInput; value: number } | null>(null);
  const [trace, setTrace] = useState<{ label: string; from: string; to: string; before: number; after: number; event: number } | null>(null);
  const inputSignature = inputKey(input), resultSignature = inputKey(calculated);
  useEffect(() => {
    if (pending || inputSignature !== resultSignature) return;
    const old = previous.current;
    previous.current = { input: calculated, value };
    if (!old) return;
    const a = old.input as unknown as Record<string, unknown>, b = calculated as unknown as Record<string, unknown>;
    if (["seed", "samples", "noise", "dataset", "fraction", "panel"].some(key => a[key] !== b[key])) { setTrace(null); return; }
    const changed = Object.keys(labels).filter(key => inputKey(a[key]) !== inputKey(b[key]));
    if (changed.length !== 1) return;
    const key = changed[0];
    function text(v: unknown) {
      if (key === "edits") return `${Array.isArray(v) ? v.length : 0}处编辑`;
      if (typeof v === "number") return v !== 0 && Math.abs(v) < .001 ? v.toExponential(0) : String(v);
      return ({logistic:"逻辑回归",svm:"SVM",knn:"K近邻",tree:"决策树",forest:"随机森林"})[String(v) as "svm"] ?? String(v);
    }
    setTrace(t => ({label:labels[key],from:text(a[key]),to:text(b[key]),before:old.value,after:value,event:(t?.event ?? 0)+1}));
  }, [inputSignature, resultSignature, pending, calculated, value]);
  return <details className="island-causal-trace">
    <summary><ScanLine size={20} />{trace ? "回看刚才的变化" : "怎样看见操作的影响"}</summary>
    {trace ? <div key={trace.event} className="causal-change"><p>{trace.label} {trace.from} <ArrowRight size={18} /> {trace.to}</p>
      <p>{metric} <strong>{proofNumber(trace.before,panel)}</strong><ArrowRight size={18} /><strong>{proofNumber(trace.after,panel)}</strong></p>
      <button className="text-button" onClick={onLocate}>定位对应证据</button></div> : <p>只调一个条件，等待“已实算”，这里会保留最近一次操作与结果的前后对照。</p>}
  </details>;
}
