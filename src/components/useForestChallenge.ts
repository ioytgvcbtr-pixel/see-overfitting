"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/experiment";
import {
  classKey,
  type ClassInput,
  type ClassResult,
} from "@/lib/classification";
import {
  readProgress,
  saveProgress,
  type ForestDraft,
} from "@/lib/island-progress";
import { rescueObservation } from "@/lib/island-experiments";

export function useForestChallenge(
  input: ClassInput,
  result: ClassResult,
  selected: number | null,
  pending: boolean,
  onInput: (p: ClassInput) => void,
  onSelect: (row: number) => void,
  onRescue: () => void,
  resume: ForestDraft | null,
  onConsumed: () => void,
) {
  const [checked, setChecked] = useState<{ key: string; gate: number } | null>(
      null,
    ),
    [rescue, setRescue] = useState<{ before: ClassResult; row: number } | null>(
      null,
    );
  const [hintLevel, setHintLevel] = useState(0),
    [rescueHint, setRescueHint] = useState(0),
    [motionEvent, setMotionEvent] = useState(0),
    [engaged, setEngaged] = useState(false),
    [hydrated, setHydrated] = useState(false);
  const [paused, setPaused] = useState<ForestDraft | null>(null),
    [restoring, setRestoring] = useState<ForestDraft | null>(null),
    [baseline, setBaseline] = useState<ClassResult | null>(null),
    [baselineLoaded, setBaselineLoaded] = useState(false),
    [error, setError] = useState(""),
    [saveError, setSaveError] = useState("");
  const request = useRef<AbortController | null>(null),
    wasFixed = useRef(false),
    skipCelebration = useRef(false);
  const point =
      result.validation.find((p) => p.row === (rescue?.row ?? selected)) ??
      result.validation[0],
    key = `${classKey(input)}:${point.row}`,
    matched = !pending && classKey(result.parameters) === classKey(input);
  const current =
    checked?.key === key && matched && !restoring ? checked : null;
  const rescued =
    rescue && matched && !restoring
      ? rescueObservation(rescue.before, result, rescue.row)
      : null;
  useEffect(() => {
    const d = readProgress("forest");
    if (d?.kind === "forest") setPaused(d);
    setHydrated(true);
    return () => request.current?.abort();
  }, []);
  function write(d: ForestDraft) {
    const ok = saveProgress(d);
    setSaveError(ok ? "" : "进度暂未保存，请检查浏览器存储后重试。");
    return ok;
  }
  function load(d: ForestDraft) {
    request.current?.abort();
    setError("");
    setBaseline(null);
    setBaselineLoaded(false);
    if (!d.rescueInput) {
      setBaselineLoaded(true);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    api<ClassResult>("/classification/run", d.rescueInput, controller.signal)
      .then((v) => {
        if (!controller.signal.aborted) {
          setBaseline(v);
          setBaselineLoaded(true);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(`救援起点复算失败：${e.message}`);
      });
  }
  useEffect(() => {
    if (!resume) return;
    setRestoring(resume);
    setEngaged(false);
    setChecked(null);
    setRescue(null);
    setHintLevel(0);
    setRescueHint(0);
    setMotionEvent(0);
    onInput(resume.current);
    onSelect(resume.row);
    if (resume.rescueInput) onRescue();
    load(resume);
    onConsumed();
  }, [resume]);
  useEffect(() => {
    if (!restoring || !baselineLoaded || !matched) return;
    const row = result.validation.some((p) => p.row === restoring.row)
      ? restoring.row
      : result.validation[0].row;
    if (selected !== row) {
      onSelect(row);
      return;
    }
    const same =
      classKey(input) === classKey(restoring.current) && row === restoring.row;
    setChecked(same ? restoring.checked : null);
    setHintLevel(same ? restoring.hintLevel : 0);
    setRescueHint(same ? restoring.rescueHint : 0);
    setRescue(
      baseline && restoring.rescueRow !== null
        ? { before: baseline, row: restoring.rescueRow }
        : null,
    );
    skipCelebration.current = true;
    setMotionEvent(0);
    setEngaged(true);
    setRestoring(null);
  }, [restoring, baselineLoaded, matched, result, selected, baseline]);
  useEffect(() => {
    if (restoring) return;
    setChecked(null);
    setHintLevel(0);
    setRescueHint(0);
    setMotionEvent(0);
  }, [key]);
  useEffect(() => {
    if (!matched || restoring) return;
    if (!rescue) {
      wasFixed.current = false;
      return;
    }
    const fixed = !!rescued?.fixed;
    if (skipCelebration.current) {
      skipCelebration.current = false;
      wasFixed.current = fixed;
      return;
    }
    if (fixed && !wasFixed.current) setMotionEvent((n) => n + 1);
    wasFixed.current = fixed;
  }, [matched, restoring, rescue, rescued?.fixed]);
  function draft(active: boolean): ForestDraft {
    return {
      version: 1,
      kind: "forest",
      updatedAt: new Date().toISOString(),
      active,
      current: input,
      row: point.row,
      checked,
      rescueInput: rescue?.before.parameters ?? null,
      rescueRow: rescue?.row ?? null,
      hintLevel,
      rescueHint,
    };
  }
  useEffect(() => {
    if (hydrated && engaged && !restoring) write(draft(true));
  }, [
    hydrated,
    engaged,
    restoring,
    input,
    point.row,
    checked,
    rescue,
    hintLevel,
    rescueHint,
  ]);
  function choose(row: number) {
    request.current?.abort();
    setRestoring(null);
    setError("");
    setEngaged(true);
    setChecked(null);
    setRescue(null);
    setHintLevel(0);
    setRescueHint(0);
    setMotionEvent(0);
    onSelect(row);
  }
  function deliver(gate: number) {
    if (!matched || restoring) return;
    setEngaged(true);
    if (checked?.key !== key || checked.gate !== gate)
      setMotionEvent((n) => n + 1);
    setChecked({ key, gate });
  }
  function beginRescue() {
    if (!matched || point.correct) return;
    setEngaged(true);
    setRescue({ before: result, row: point.row });
    setChecked(null);
    setMotionEvent(0);
    wasFixed.current = false;
    setRescueHint(0);
    onSelect(point.row);
    onRescue();
  }
  function pause() {
    const d = draft(false);
    write(d);
    setPaused(d);
    request.current?.abort();
    setRestoring(null);
    setEngaged(false);
    setChecked(null);
    setRescue(null);
    setHintLevel(0);
    setRescueHint(0);
    setMotionEvent(0);
    setError("");
  }
  return {
    point,
    key,
    matched,
    current,
    rescued,
    rescue,
    engaged,
    paused,
    restoring: !!restoring,
    error,
    saveError,
    motionEvent,
    hintLevel,
    rescueHint,
    setHintLevel,
    setRescueHint,
    choose,
    deliver,
    beginRescue,
    pause,
    change: (patch: Partial<ClassInput>) => {
      setEngaged(true);
      onInput({ ...input, ...patch });
    },
    endRescue: () => setRescue(null),
    retry: () => {
      if (restoring) load(restoring);
    },
  };
}
