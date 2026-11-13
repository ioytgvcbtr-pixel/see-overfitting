"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Check, RefreshCw } from "lucide-react";
import { api, scenes, type Parameters } from "@/lib/experiment";

type Entry = {
  id: string;
  created_at: string;
  stage: "experiment" | "transfer" | "complete";
  parameters: Parameters;
  observed_count: number;
  transfer_count: number;
  first_transfer_passed: boolean | null;
  last_transfer_passed: boolean | null;
  prediction_matched: boolean | null;
  prediction: { label: string; confidence: number; reason: string };
};

export default function StudyNotebook({
  onOpen,
}: {
  onOpen: (id: string, fresh: boolean) => Promise<void>;
}) {
  const [items, setItems] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<Entry[]>("/learning/history", undefined, controller.signal)
      .then(setItems)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  async function open(id: string, fresh: boolean) {
    setPending(id);
    setError("");
    try {
      await onOpen(id, fresh);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  const visible = items.filter(
    (item) =>
      filter === "all" ||
      (filter === "active"
        ? item.stage !== "complete"
        : item.prediction_matched === false ||
          item.first_transfer_passed === false),
  );
  return (
    <section className="study-notebook" aria-label="学习足迹">
      <div className="section-title">
        <div>
          <span className="section-symbol">
            <BookOpen size={21} />
          </span>
          <h2>每个判断，都有来路</h2>
          <p>回看预测、错答与重试，或换一批数据再挑战。</p>
        </div>
        <div className="notebook-filters" aria-label="筛选学习记录">
          {[
            ["all", "全部记录"],
            ["active", "待继续"],
            ["reflect", "值得复盘"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="action-error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            重新读取
          </button>
        </p>
      )}
      {loading ? (
        <p className="notebook-empty">正在读取学习足迹…</p>
      ) : !visible.length ? (
        <p className="notebook-empty">
          {items.length
            ? "当前筛选下还没有记录。"
            : "提交一次预测后，这里会记录你的实验过程。"}
        </p>
      ) : (
        <ol className="study-list">
          {visible.map((item) => (
            <li
              key={item.id}
              data-study-id={item.id}
              className={`study-entry scene-${item.parameters.scene}`}
            >
              <span className="study-mark">
                {item.stage === "complete" ? (
                  <Check size={20} />
                ) : (
                  <BookOpen size={20} />
                )}
              </span>
              <div className="study-description">
                <div className="study-entry-title">
                  <h3>
                    {
                      scenes.find((scene) => scene.id === item.parameters.scene)
                        ?.short
                    }
                  </h3>
                  <span>
                    {item.stage === "complete"
                      ? "已完成闭环"
                      : item.stage === "transfer"
                        ? "待迁移验证"
                        : "实验进行中"}
                  </span>
                </div>
                <p>
                  预测 <strong>{item.prediction.label}</strong> ·{" "}
                  {item.prediction_matched === null
                    ? `已观察 ${item.observed_count}/3 个条件`
                    : item.prediction_matched
                      ? "与本轮实算一致"
                      : "与本轮实算不同"}
                </p>
                <small>
                  {new Date(item.created_at).toLocaleString("zh-CN")} · seed{" "}
                  {item.parameters.seed}
                  {item.transfer_count > 0
                    ? ` · 迁移 ${item.transfer_count} 次，首次${item.first_transfer_passed ? "通过" : "未通过"}`
                    : " · 尚未提交迁移判断"}
                </small>
                <details>
                  <summary>回看判断依据</summary>
                  <p>{item.prediction.reason || "本轮未填写文字依据。"}</p>
                </details>
              </div>
              <div className="study-entry-actions">
                <button
                  className="button secondary"
                  disabled={!!pending}
                  onClick={() => void open(item.id, false)}
                >
                  {pending === item.id
                    ? "正在打开…"
                    : item.stage === "complete"
                      ? "回看本轮"
                      : "继续本轮"}
                  <ArrowUpRight size={15} />
                </button>
                <button
                  className="text-button"
                  disabled={!!pending}
                  onClick={() => void open(item.id, true)}
                >
                  <RefreshCw size={14} />
                  新数据再挑战
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
