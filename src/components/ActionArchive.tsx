"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/experiment";
import { actionValue, type VerifiedAction } from "@/lib/actions";
import { VerificationResult } from "./ActionExperiment";

export default function ActionArchive() {
  const [items, setItems] = useState<VerifiedAction[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api<VerifiedAction[]>("/actions/history", undefined, controller.signal)
      .then(setItems)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <section className="panel action-archive" aria-label="建议核验档案">
      <div className="panel-heading compact">
        <div>
          <h2>每个建议，都留下核验结果</h2>
          <p>保存执行前后条件、实际指标和未被支持的预期。</p>
        </div>
      </div>
      {error ? (
        <p className="action-error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            重新读取
          </button>
        </p>
      ) : items.length ? (
        items.map((item) => (
          <details key={item.id} className="action-archive-item">
            <summary>
              <span>
                {item.before.dataset?.title || "基础实验"} · {item.change.label}{" "}
                {actionValue(item.change.control, item.change.from_value)} →{" "}
                {actionValue(item.change.control, item.change.to_value)}
              </span>
              <span>
                {item.verdict === "supported"
                  ? "支持预期"
                  : item.verdict === "not_supported"
                    ? "不支持预期"
                    : "记录观察"}
              </span>
            </summary>
            <p>
              {item.mode === "online"
                ? "AI建议"
                : item.mode === "rules"
                  ? "规则建议"
                  : "实验建议"}
              {item.model ? ` · ${item.model}` : ""}
            </p>
            <VerificationResult value={item} />
          </details>
        ))
      ) : (
        <p className="archive-empty">
          执行一次建议后，这里将保留可复算的对照记录。
        </p>
      )}
    </section>
  );
}
