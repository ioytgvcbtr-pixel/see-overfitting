"use client";
import { useLayoutEffect, useRef, useState } from "react";
export function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(
      Math.max(280, Math.round(ref.current.getBoundingClientRect().width)),
    );
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.round(entry.contentRect.width))),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
