"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/experiment";
import {
  conceptKey,
  type ConceptInput,
  type ConceptResult,
} from "@/lib/concepts";

export function useConceptExperiment(input: ConceptInput, ready: boolean) {
  const [result, setResult] = useState<ConceptResult | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const lastSent = useRef(0);
  const sequence = useRef(0);
  const operation = useRef<AbortController | null>(null);
  const latest = useRef(input);
  latest.current = input;
  const key = conceptKey(input);
  useEffect(() => {
    if (!ready) return;
    setError("");
    const delay = Math.max(0, 90 - (performance.now() - lastSent.current));
    const timer = setTimeout(() => {
      operation.current?.abort();
      const controller = new AbortController();
      operation.current = controller;
      const id = ++sequence.current;
      lastSent.current = performance.now();
      api<ConceptResult>("/concepts/run", latest.current, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted && sequence.current === id)
            setResult(value);
        })
        .catch((e) => {
          if (e.name !== "AbortError" && sequence.current === id)
            setError(e.message);
        });
    }, delay);
    return () => clearTimeout(timer);
  }, [key, retry, ready]);
  useEffect(() => () => operation.current?.abort(), []);
  const visible = result?.parameters.panel === input.panel ? result : null;
  return {
    result: visible,
    error,
    pending: !visible || conceptKey(visible.parameters) !== key,
    retry: () => setRetry((value) => value + 1),
  };
}
