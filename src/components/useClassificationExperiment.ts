"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/experiment";
import {
  classKey,
  type ClassInput,
  type ClassResult,
} from "@/lib/classification";

export function useClassificationExperiment(input: ClassInput, ready: boolean) {
  const [result, setResult] = useState<ClassResult | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const last = useRef(0),
    sequence = useRef(0),
    operation = useRef<AbortController | null>(null),
    latest = useRef(input);
  latest.current = input;
  const key = classKey(input);
  useEffect(() => {
    if (!ready) return;
    setError("");
    const timer = setTimeout(
      () => {
        operation.current?.abort();
        const controller = new AbortController();
        operation.current = controller;
        const id = ++sequence.current;
        last.current = performance.now();
        api<ClassResult>(
          "/classification/run",
          latest.current,
          controller.signal,
        )
          .then((value) => {
            if (!controller.signal.aborted && sequence.current === id)
              setResult(value);
          })
          .catch((e) => {
            if (e.name !== "AbortError" && sequence.current === id)
              setError(e.message);
          });
      },
      Math.max(0, 150 - (performance.now() - last.current)),
    );
    return () => clearTimeout(timer);
  }, [key, ready, retry]);
  useEffect(() => () => operation.current?.abort(), []);
  const visible = result?.parameters.dataset === input.dataset ? result : null;
  return {
    result: visible,
    error,
    pending: !visible || classKey(visible.parameters) !== key,
    retry: () => setRetry((n) => n + 1),
  };
}
