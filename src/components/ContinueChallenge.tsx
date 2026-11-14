"use client";
import { useLayoutEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, BookmarkCheck } from "lucide-react";
import {
  latestProgress,
  challengeTitles,
  type ChallengeId,
} from "@/lib/island-progress";

export default function ContinueChallenge({
  onContinue,
}: {
  onContinue: (id: ChallengeId) => void;
}) {
  const [items, setItems] = useState<ReturnType<typeof latestProgress>>([]);
  useLayoutEffect(() => {
    setItems(latestProgress());
  }, []);
  const latest = items[0];
  if (!latest) return null;
  return (
    <section className="continue-challenge" aria-label="继续上次挑战">
      <div className="continue-guide">
        <Image
          src="/illustrations/fitlab-guide-v1.png"
          loading="eager"
          alt=""
          fill
          sizes="96px"
          style={{ objectFit: "contain" }}
        />
      </div>
      <div className="continue-challenge-copy">
        <h2>继续上次挑战</h2>
        <p>
          <BookmarkCheck size={22} />
          {challengeTitles[latest.id]}
          <span>
            {latest.draft.checked ? "已保存作答，返回后复核" : "操作进度已保存"}
          </span>
        </p>
      </div>
      <button className="button primary" onClick={() => onContinue(latest.id)}>
        继续
        <ArrowRight size={20} />
      </button>
    </section>
  );
}
