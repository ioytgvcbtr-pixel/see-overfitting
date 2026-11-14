"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

export default function HelpHint({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId(),
    button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pinned = useRef(false),
    pointerDown = useRef(false),
    dismissed = useRef(false);
  const [open, setOpen] = useState(false);
  function clear() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }
  function position() {
    const anchor = button.current!,
      tip = panel.current!,
      viewportWidth = document.documentElement.clientWidth,
      viewportHeight = document.documentElement.clientHeight;
    tip.style.maxWidth = `${viewportWidth - 32}px`;
    tip.style.maxHeight = `${viewportHeight - 32}px`;
    const r = anchor.getBoundingClientRect(),
      box = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(16, Math.min(viewportWidth - box.width - 16, r.left + r.width / 2 - box.width / 2))}px`;
    tip.style.top = `${Math.max(16, r.bottom + 10 + box.height <= viewportHeight - 16 ? r.bottom + 10 : r.top - box.height - 10)}px`;
  }
  function show(pin = false) {
    clear();
    if (pin) pinned.current = true;
    dismissed.current = false;
    const tip = panel.current!;
    if (!tip.matches(":popover-open")) tip.showPopover();
    position();
  }
  function hide() {
    clear();
    pinned.current = false;
    if (panel.current?.matches(":popover-open")) panel.current.hidePopover();
  }
  function queueClose(force = false) {
    clear();
    if (!force && (pinned.current || document.activeElement === button.current))
      return;
    timer.current = setTimeout(hide, 140);
  }
  useEffect(() => () => clear(), []);
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissed.current = true;
        hide();
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(panel.current!);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="help-hint-trigger"
        aria-label={title}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={`${id}-body`}
        popoverTarget={id}
        onPointerDown={() => {
          pointerDown.current = true;
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") show();
        }}
        onPointerLeave={() => queueClose()}
        onFocus={() => {
          if (!pointerDown.current && !dismissed.current) show();
        }}
        onBlur={() => {
          pointerDown.current = false;
          dismissed.current = false;
          queueClose(true);
        }}
        onClick={(e) => {
          e.preventDefault();
          pointerDown.current = false;
          if (pinned.current && panel.current?.matches(":popover-open")) hide();
          else show(true);
        }}
      >
        <CircleHelp size={17} aria-hidden="true" />
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="tooltip"
        className="help-hint-panel"
        onPointerEnter={clear}
        onPointerLeave={() => queueClose()}
        onToggle={(e) => {
          const showing = e.currentTarget.matches(":popover-open");
          setOpen(showing);
          if (!showing) {
            pinned.current = false;
            clear();
          }
        }}
      >
        <strong>{title}</strong>
        <div id={`${id}-body`}>{children}</div>
      </div>
    </>
  );
}
