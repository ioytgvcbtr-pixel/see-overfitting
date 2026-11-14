"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Pause, Play, BadgeCheck, Compass, BookmarkCheck } from "lucide-react";

export type CompanionMood = "welcome" | "thinking" | "celebrate" | "resume";
export default function LearningCompanion({
  mood,
  title,
  message,
  event = 0,
}: {
  mood: CompanionMood;
  title: string;
  message: string;
  event?: number;
}) {
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setMotion(localStorage.getItem("fitlab-companion-motion-v1") !== "off");
      } catch {
        setMotion(true);
      }
    };
    read();
    window.addEventListener("fitlab-companion-preference", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("fitlab-companion-preference", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  function toggle() {
    const next = !motion;
    setMotion(next);
    try {
      localStorage.setItem("fitlab-companion-motion-v1", next ? "on" : "off");
      window.dispatchEvent(new Event("fitlab-companion-preference"));
    } catch {}
  }
  const source =
    mood === "celebrate"
      ? "/illustrations/companion-v12/guide-celebrate-v1.png"
      : mood === "thinking"
        ? "/illustrations/companion-v12/guide-thinking-v1.png"
        : "/illustrations/fitlab-guide-v1.png";
  return (
    <aside
      className={`learning-companion mood-${mood}`}
      aria-label="学习向导回应"
    >
      <div
        key={`${mood}:${event}`}
        className={`companion-portrait ${motion && event > 0 && (mood === "celebrate" || mood === "thinking") ? "responding" : ""}`}
      >
        <Image
          src={source}
          alt=""
          fill
          sizes="(max-width:600px) 80px, 96px"
          style={{ objectFit: "contain" }}
        />
        {mood !== "welcome" && (
          <span className="companion-badge" aria-hidden="true">
            {mood === "celebrate" ? (
              <BadgeCheck size={24} />
            ) : mood === "thinking" ? (
              <Compass size={24} />
            ) : (
              <BookmarkCheck size={24} />
            )}
          </span>
        )}
      </div>
      <div className="companion-message" aria-live="polite">
        <strong>{title}</strong>
        <p>{message}</p>
        <button
          className="companion-motion"
          type="button"
          aria-label={motion ? "关闭角色动效" : "开启角色动效"}
          aria-pressed={motion}
          onClick={toggle}
        >
          {motion ? <Pause size={20} /> : <Play size={20} />}动效
          {motion ? "开" : "关"}
        </button>
      </div>
    </aside>
  );
}
