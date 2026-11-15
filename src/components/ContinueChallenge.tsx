"use client";
import { useLayoutEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, BookmarkCheck } from "lucide-react";
import {
  latestProgress,
  challengeTitles,
  type ChallengeId,
} from "@/lib/island-progress";
import type { WorkspaceEntry } from "@/lib/workspace";

export default function ContinueChallenge({
  onContinue,
  entry,
  onResumeEntry,
}: {
  onContinue: (id: ChallengeId) => void;
  entry?: WorkspaceEntry | null;
  onResumeEntry?: (entry: WorkspaceEntry) => Promise<void>;
}) {
  const [items, setItems] = useState<ReturnType<typeof latestProgress>>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  useLayoutEffect(() => {
    setItems(latestProgress());
  }, []);
  const latest = items[0];
  if (!latest && !entry) return null;
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
        <h2>{entry?.stage==="complete"?"回看最近的发现":"继续学习"}</h2>
        <p>
          <BookmarkCheck size={22} />
          {entry?.title ?? (latest ? challengeTitles[latest.id] : "")}
          <span>
            {entry?.status ?? (latest?.draft.checked ? "已保存作答，返回后复核" : "操作进度已保存")}
          </span>
        </p>
      </div>
      {error&&<p role="alert">{error}</p>}
      <button className="button primary" disabled={busy} onClick={async () => {
        if(entry&&onResumeEntry){setBusy(true);setError("");try{await onResumeEntry(entry);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
        else if(latest)onContinue(latest.id);
      }}>
        {busy?"正在打开":entry?.stage==="complete"?"回看":"继续"}
        <ArrowRight size={20} />
      </button>
    </section>
  );
}
