"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/experiment";
import {
  conceptDefaults,
  conceptKey,
  type ConceptInput,
  type ConceptResult,
} from "@/lib/concepts";
import { observeQuest } from "@/lib/island-experiments";
import {
  readProgress,
  saveProgress,
  type ConceptDraft,
  type SavedCheck,
} from "@/lib/island-progress";

export function useConceptChallenge(
  input: ConceptInput,
  result: ConceptResult,
  pending: boolean,
  onInput: (p: ConceptInput) => void,
  resume: ConceptDraft | null,
  onConsumed: () => void,
  selected: number,
) {
  const [origin, setOrigin] = useState<ConceptInput | null>(null),
    [startInput, setStartInput] = useState<ConceptInput | null>(null),
    [baseline, setBaseline] = useState<ConceptResult | null>(null);
  const [active, setActive] = useState(false),
    [loading, setLoading] = useState(false),
    [hydrated, setHydrated] = useState(false),
    [paused, setPaused] = useState<ConceptDraft | null>(null),
    [restoring, setRestoring] = useState<ConceptDraft | null>(null);
  const [answer, setAnswer] = useState(""),
    [checked, setChecked] = useState<SavedCheck | null>(null),
    [hintLevel, setHintLevel] = useState(0),
    [motionEvent, setMotionEvent] = useState(0);
  const [error, setError] = useState(""),
    [saveError, setSaveError] = useState("");
  const request = useRef<AbortController | null>(null),
    key = conceptKey(input),
    matched = !pending && conceptKey(result.parameters) === key;
  const answerKey = useRef(key),
    hintKey = useRef(key),
    answerValue = answerKey.current === key ? answer : "",
    hintValue = hintKey.current === key ? hintLevel : 0;
  useEffect(() => {
    const d = readProgress(input.panel);
    if (d?.kind === "concept") setPaused(d);
    setHydrated(true);
    return () => request.current?.abort();
  }, []);
  function write(d: ConceptDraft) {
    const ok = saveProgress(d);
    setSaveError(ok ? "" : "进度暂未保存，请检查浏览器存储后重试。");
    return ok;
  }
  function compute(p: ConceptInput) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setBaseline(null);
    setError("");
    api<ConceptResult>("/concepts/run", p, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setBaseline(value);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(`起点复算失败：${e.message}`);
          setLoading(false);
        }
      });
  }
  useEffect(() => {
    if (!resume || resume.current.panel !== input.panel) return;
    setOrigin(resume.origin);
    setStartInput(resume.start);
    setActive(true);
    setRestoring(resume);
    setAnswer("");
    setChecked(null);
    setHintLevel(0);
    setMotionEvent(0);
    onInput(resume.current);
    compute(resume.start);
    onConsumed();
  }, [resume]);
  useEffect(() => {
    if (!restoring || !baseline || !matched) return;
    const same = conceptKey(restoring.current) === key;
    answerKey.current = key;
    hintKey.current = key;
    setAnswer(same ? restoring.answer : "");
    setChecked(same ? restoring.checked : null);
    setHintLevel(same ? restoring.hintLevel : 0);
    setRestoring(null);
  }, [restoring, baseline, matched, key]);
  useEffect(() => {
    if (restoring) return;
    setAnswer("");
    setChecked(null);
    setHintLevel(0);
    setMotionEvent(0);
  }, [key]);
  useEffect(() => {
    if (!hydrated || !active || !origin || !startInput || restoring) return;
    write({
      version: 1,
      kind: "concept",
      updatedAt: new Date().toISOString(),
      active: true,
      origin,
      start: startInput,
      current: input,
      selected,
      answer: answerValue,
      checked,
      hintLevel: hintValue,
    });
  }, [
    hydrated,
    active,
    origin,
    startInput,
    input,
    answerValue,
    checked,
    hintValue,
    restoring,
    selected,
  ]);
  const observation = baseline ? observeQuest(baseline, result) : null;
  const canCheck =
    active && !loading && !restoring && matched && !!observation?.ready;
  const currentCheck = canCheck && checked?.key === key ? checked : null;
  const correct =
    !!currentCheck && currentCheck.answer === observation?.correct;
  function start() {
    const original = origin ?? structuredClone(input),
      next = {
        ...conceptDefaults,
        panel: input.panel,
        slope: 1.8,
        intercept: 0.8,
        alpha: input.panel === "sensitivity" ? 1e-6 : 1e-8,
      };
    const d: ConceptDraft = {
      version: 1,
      kind: "concept",
      updatedAt: new Date().toISOString(),
      active: true,
      origin: original,
      start: next,
      current: next,
      selected: Math.min(selected, next.samples - 1),
      answer: "",
      checked: null,
      hintLevel: 0,
    };
    write(d);
    setOrigin(original);
    setStartInput(next);
    setActive(true);
    setRestoring(null);
    setAnswer("");
    setChecked(null);
    setHintLevel(0);
    setMotionEvent(0);
    onInput(next);
    compute(next);
  }
  function verify() {
    if (!canCheck || !answerValue) return;
    if (checked?.key !== key || checked.answer !== answerValue)
      setMotionEvent((n) => n + 1);
    setChecked({ key, answer: answerValue });
  }
  function pause() {
    if (!origin || !startInput) return;
    const d: ConceptDraft = {
      version: 1,
      kind: "concept",
      updatedAt: new Date().toISOString(),
      active: false,
      origin,
      start: startInput,
      current: input,
      selected,
      answer: answerValue,
      checked,
      hintLevel: hintValue,
    };
    write(d);
    setPaused(d);
    request.current?.abort();
    onInput(origin);
    setOrigin(null);
    setStartInput(null);
    setBaseline(null);
    setActive(false);
    setRestoring(null);
    setLoading(false);
    setError("");
    setAnswer("");
    setChecked(null);
    setHintLevel(0);
    setMotionEvent(0);
  }
  return {
    active,
    loading,
    restoring: !!restoring,
    paused,
    baseline,
    answer: answerValue,
    checked: currentCheck,
    correct,
    observation,
    canCheck,
    matched,
    hintLevel: hintValue,
    setHintLevel: (n: number) => {
      hintKey.current = key;
      setHintLevel(n);
    },
    motionEvent,
    error,
    saveError,
    start,
    verify,
    pause,
    retry: () => {
      if (startInput) compute(startInput);
    },
    choose: (value: string) => {
      answerKey.current = key;
      setAnswer(value);
      setChecked(null);
    },
  };
}
