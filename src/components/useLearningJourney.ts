"use client";
import { useEffect, useRef, useState } from "react";
import { api, type Parameters, type Result } from "@/lib/experiment";
import { hasAttemptFor, type LearningAttempt } from "@/lib/learning-session";

const storageKey = (scene: string) => `fitlab-learning-attempt-v1:${scene}`;

export function useLearningJourney(
  params: Parameters,
  onRestore: (params: Parameters) => void,
  enabled = true,
) {
  const [attempt, setAttempt] = useState<LearningAttempt | null>(null);
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<AbortController | null>(null);
  const activeId = hasAttemptFor(params, attempt) ? attempt!.id : null;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setReady(false);
    setWorking(false);
    setAttempt(null);
    setError("");
    const id = localStorage.getItem(storageKey(params.scene));
    if (!id) {
      setReady(true);
      return () => {
        controller.abort();
        operation.current?.abort();
      };
    }
    api<LearningAttempt>(
      `/learning/attempts/${id}`,
      undefined,
      controller.signal,
    )
      .then((value) => {
        setAttempt(value);
        onRestore(value.last_parameters || value.parameters);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError("本轮记录暂未恢复，可重新提交预测。");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => {
      controller.abort();
      operation.current?.abort();
    };
    // Restoring is a course transition, not a request on every slider move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.scene, enabled]);

  async function begin(choice: number, confidence: number, reason: string) {
    const controller = new AbortController();
    operation.current = controller;
    setWorking(true);
    setError("");
    try {
      const value = await api<LearningAttempt>(
        "/learning/attempts",
        {
          parameters: params,
          choice,
          confidence,
          reason,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      localStorage.setItem(storageKey(params.scene), value.id);
      setAttempt(value);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setWorking(false);
    }
  }
  async function observe(parameters: Parameters, signal: AbortSignal) {
    const value = await api<{ result: Result; attempt: LearningAttempt }>(
      `/learning/attempts/${activeId}/observe`,
      parameters,
      signal,
    );
    if (!signal.aborted) setAttempt(value.attempt);
    return value.result;
  }
  async function transfer(choice: number, reason: number) {
    if (!activeId || !attempt?.task) return;
    const controller = new AbortController();
    operation.current = controller;
    setWorking(true);
    setError("");
    try {
      setAttempt(
        await api<LearningAttempt>(
          `/learning/attempts/${activeId}/transfer`,
          {
            task_id: attempt.task.id,
            choice,
            reason,
          },
          controller.signal,
        ),
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setWorking(false);
    }
  }
  async function retryTransfer() {
    const controller = new AbortController();
    operation.current = controller;
    setWorking(true);
    setError("");
    try {
      setAttempt(
        await api<LearningAttempt>(
          `/learning/attempts/${activeId}/retry`,
          {},
          controller.signal,
        ),
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setWorking(false);
    }
  }
  function reset(scene = params.scene) {
    operation.current?.abort();
    setWorking(false);
    localStorage.removeItem(storageKey(scene));
    localStorage.setItem("fitlab-current-scene-v1", scene);
    setAttempt(null);
    setError("");
  }
  return {
    attempt: activeId ? attempt : null,
    activeId,
    ready,
    working,
    error,
    begin,
    observe,
    transfer,
    retryTransfer,
    reset,
  };
}
