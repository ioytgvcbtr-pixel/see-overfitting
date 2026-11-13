"use client";
import { useState } from "react";
import {
  Search,
  Columns2,
  Move,
  SlidersHorizontal,
  ArrowRight,
  Camera,
  RotateCcw,
} from "lucide-react";
import { classPercent, type ClassResult } from "@/lib/classification";
import {
  classRecipes,
  type ClassRecipeId,
  type PlayMode,
} from "@/lib/exploration";

export default function ClassPlayPanel({
  play,
  result,
  pending,
  onRecipe,
  onShowCanvas,
}: {
  play: {
    mode: PlayMode;
    setMode: (v: PlayMode) => void;
    found: number[];
    revealed: boolean;
    reveal: () => void;
    feedback: string;
    snapshot: ClassResult | null;
    referenceLoading: boolean;
    referenceError: string;
    paired: boolean;
    curtain: number;
    setCurtain: (v: number) => void;
    pin: () => void;
    restore: () => void;
    canPin: boolean;
    clear: () => void;
  };
  result: ClassResult | null;
  pending: boolean;
  onRecipe: (id: ClassRecipeId) => void;
  onShowCanvas: () => void;
}) {
  const [recipesOpen, setRecipesOpen] = useState(false);
  return (
    <section className="class-play" aria-label="分类探索玩法">
      <div className="play-topline">
        <div className="play-modes" role="group" aria-label="选择探索玩法">
          {(
            [
              { id: "explore", name: "自由探索", Icon: Move },
              { id: "detective", name: "错分侦探", Icon: Search },
              { id: "compare", name: "A/B对照", Icon: Columns2 },
            ] as const
          ).map(({ id, name, Icon }) => (
            <button
              key={id}
              aria-pressed={play.mode === id}
              onClick={() => play.setMode(id)}
            >
              <Icon size={16} aria-hidden="true" />
              {name}
            </button>
          ))}
        </div>
        <details
          className="play-recipes"
          open={recipesOpen}
          onKeyDown={(e) => {
            if (e.key === "Escape" && e.currentTarget.open) {
              e.preventDefault();
              setRecipesOpen(false);
              e.currentTarget.querySelector<HTMLElement>("summary")?.focus();
            }
          }}
        >
          <summary
            onClick={(e) => {
              e.preventDefault();
              setRecipesOpen((value) => !value);
            }}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            实验配方
          </summary>
          <div>
            {classRecipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => {
                  onRecipe(recipe.id);
                  setRecipesOpen(false);
                }}
              >
                <strong>{recipe.title}</strong>
                <span>{recipe.description}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </details>
      </div>
      {play.mode === "explore" && (
        <p className="play-free-note">
          选模型，看边界；点一个样本，查看它的判断。合成训练点可以拖动，也能用下方方向按钮移动。
        </p>
      )}
      {play.mode === "detective" && (
        <div className="detective-task">
          <div className="detective-copy">
            <span className="play-task-label">
              <Search size={16} />
              这次，先找再揭晓
            </span>
            <h2>找出被模型看错的空心点。</h2>
            <p>
              底色是模型猜测的类别。验证点的类别与底色不一致时，就可能被错分。
            </p>
            <p className="detective-feedback">
              {play.feedback || "点一个验证点，检查你的发现。"}
            </p>
            <button className="text-button" onClick={onShowCanvas}>
              到图上寻找
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="detective-score">
            <strong>
              {pending ? "—" : play.found.length}
              <small> / {result?.metrics.mistakes ?? "—"}</small>
            </strong>
            <span>本次已定位</span>
            {result?.metrics.mistakes === 0 ? (
              <button
                className="text-button"
                onClick={() => onRecipe("detective")}
              >
                这轮没有错分，试试XOR
              </button>
            ) : (
              <button
                className="text-button"
                disabled={!result || pending}
                onClick={play.reveal}
              >
                {play.revealed ? "收起全部标记" : "揭晓全部错分"}
              </button>
            )}
          </div>
        </div>
      )}
      {play.mode === "compare" && (
        <div className="comparison-play">
          <div className="comparison-instructions">
            <div>
              <h2>定格一个判断，拖开另一种可能。</h2>
              <p>
                {play.referenceLoading
                  ? "正在按保存的参数复算A…"
                  : play.referenceError
                    ? play.referenceError
                    : play.snapshot
                      ? play.paired
                        ? "A保持不动。换模型或调参数来改变B，拖动中线对照。"
                        : "数据条件已改变；恢复A条件，或重新定格当前结果。"
                      : "先把当前结果定格为A，再换一个模型作为B。"}
              </p>
            </div>
            <button
              className="button secondary"
              disabled={!play.canPin}
              onClick={() => {
                play.pin();
                requestAnimationFrame(onShowCanvas);
              }}
            >
              <Camera size={15} />
              {play.snapshot ? "重新定格A" : "定格当前为A"}
            </button>
            {play.paired && (
              <button className="text-button" onClick={onShowCanvas}>
                到对照画布
                <ArrowRight size={15} />
              </button>
            )}
          </div>
          {play.snapshot && (
            <div className="comparison-evidence">
              <div>
                <span>A · {play.snapshot.model_name}</span>
                <strong>
                  {classPercent(play.snapshot.metrics.validation_accuracy)}
                </strong>
                <small>已定格的验证准确率</small>
              </div>
              <Columns2 size={22} aria-hidden="true" />
              <div>
                <span>B · {result?.model_name ?? "计算中"}</span>
                <strong>
                  {play.paired && result
                    ? classPercent(result.metrics.validation_accuracy)
                    : "暂不对比"}
                </strong>
                <small>
                  {!play.paired
                    ? "当前数据不同"
                    : pending
                      ? "最近实算的验证准确率"
                      : "当前验证准确率"}
                </small>
              </div>
              <div className="comparison-actions">
                <button className="text-button" onClick={play.restore}>
                  <RotateCcw size={14} />
                  恢复A参数
                </button>
                <button className="text-button" onClick={play.clear}>
                  清除A
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
