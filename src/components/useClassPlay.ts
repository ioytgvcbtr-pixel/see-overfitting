"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { api } from "@/lib/experiment";
import {
  classDefaults,
  classKey,
  readClassInput,
  type ClassInput,
  type ClassResult,
} from "@/lib/classification";
import {
  canCompareRegions,
  classRecipes,
  readPlayDraft,
  recipeInput,
  verifiedFinds,
  type ClassRecipeId,
  type PlayDraft,
  type PlayMode,
} from "@/lib/exploration";

export function useClassPlay(
  input: ClassInput,
  setInput: Dispatch<SetStateAction<ClassInput>>,
  result: ClassResult | null,
  pending: boolean,
  ready: boolean,
) {
  const key = classKey(input);
  const [game, setGame] = useState<PlayDraft>({
    key,
    mode: "explore",
    found: [],
    revealed: false,
  });
  const [snapshot, setSnapshot] = useState<ClassResult | null>(null),
    [curtain, setCurtain] = useState(0.5),
    [feedback, setFeedback] = useState("");
  const [referenceLoading, setReferenceLoading] = useState(false),
    [referenceError, setReferenceError] = useState("");
  const referenceRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const saved = readPlayDraft(localStorage.getItem("fitlab-class-play-v1"));
    if (saved) setGame(saved);
    const reference = readClassInput(
      localStorage.getItem("fitlab-class-reference-v1"),
    );
    if (reference) {
      const controller = new AbortController();
      referenceRequest.current = controller;
      setReferenceLoading(true);
      api<ClassResult>("/classification/run", reference, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setSnapshot(value);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setReferenceError("A参考未能复算，请重新定格当前结果。");
        })
        .finally(() => {
          if (!controller.signal.aborted) setReferenceLoading(false);
        });
    }
    return () => referenceRequest.current?.abort();
  }, []);
  useEffect(() => {
    if (ready) {
      setGame((g) =>
        g.key === key ? g : { ...g, key, found: [], revealed: false },
      );
      setFeedback("");
    }
  }, [key, ready]);
  useEffect(() => {
    if (ready && game.key === key)
      localStorage.setItem("fitlab-class-play-v1", JSON.stringify(game));
  }, [game, key, ready]);
  const matched = !!result && !pending && classKey(result.parameters) === key;
  const found =
    matched && game.key === key
      ? verifiedFinds(result.validation, game.found)
      : [];
  const paired = game.mode === "compare" && canCompareRegions(snapshot, result);
  function mode(value: PlayMode) {
    setFeedback("");
    setGame((g) =>
      g.mode === value ? g : { key, mode: value, found: [], revealed: false },
    );
  }
  function recipe(id: ClassRecipeId) {
    const next = recipeInput(id, classDefaults),
      row = classRecipes.find((r) => r.id === id)!;
    clear();
    setCurtain(0.5);
    setFeedback("");
    setGame({
      key: classKey(next),
      mode: row.mode,
      found: [],
      revealed: false,
    });
    setInput(next);
  }
  function inspect(row: number) {
    if (game.mode !== "detective" || !matched) return;
    const point = result.validation.find((p) => p.row === row);
    if (!point) {
      setFeedback("这是实心训练点，试着检查空心的验证点。");
      return;
    }
    if (point.correct) {
      setFeedback(
        `点${row + 1}的判断正确。再找一个类别与区域底色不一致的验证点。`,
      );
      return;
    }
    setGame((g) => ({ ...g, found: [...new Set([...g.found, row])] }));
    setFeedback(
      `找到点${row + 1}：真实是${result.dataset.classes[point.label]}，模型却判断为${result.dataset.classes[point.prediction]}。`,
    );
  }
  function pin() {
    if (matched) {
      referenceRequest.current?.abort();
      setReferenceLoading(false);
      setReferenceError("");
      setSnapshot(result);
      localStorage.setItem(
        "fitlab-class-reference-v1",
        JSON.stringify(result.parameters),
      );
      setCurtain(0.5);
      mode("compare");
    }
  }
  function restore() {
    if (snapshot)
      setInput({
        ...snapshot.parameters,
        edits: snapshot.parameters.edits.map((p) => ({ ...p })),
      });
  }
  function reveal() {
    setGame((g) => ({ ...g, revealed: !g.revealed }));
  }
  function clear() {
    referenceRequest.current?.abort();
    setReferenceLoading(false);
    setReferenceError("");
    setSnapshot(null);
    localStorage.removeItem("fitlab-class-reference-v1");
  }
  return {
    mode: game.mode,
    setMode: mode,
    found,
    revealed: game.revealed,
    reveal,
    feedback,
    inspect,
    recipe,
    snapshot,
    referenceLoading,
    referenceError,
    paired,
    curtain,
    setCurtain,
    pin,
    restore,
    canPin: matched,
    clear,
  };
}
