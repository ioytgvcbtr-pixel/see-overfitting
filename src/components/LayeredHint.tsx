"use client";
import { Compass, ScanEye, MapPin } from "lucide-react";
export default function LayeredHint({
  level,
  onLevel,
  onLocate,
  first,
  second,
  disabled = false,
}: {
  level: number;
  onLevel: (n: number) => void;
  onLocate: () => void;
  first: string;
  second: string;
  disabled?: boolean;
}) {
  return (
    <section className="layered-hint" aria-label="分层提示">
      <button
        className="hint-action"
        disabled={disabled}
        onClick={() => {
          onLevel(Math.min(2, level + 1));
          onLocate();
        }}
      >
        {level === 0 ? (
          <Compass size={22} />
        ) : level === 1 ? (
          <ScanEye size={22} />
        ) : (
          <MapPin size={22} />
        )}
        <span>
          {level === 0
            ? "找一条线索"
            : level === 1
              ? "查看关键数值"
              : "回到图上证据"}
        </span>
      </button>
      {level > 0 && !disabled && (
        <div className="hint-message" role="status">
          <p>{level === 1 ? first : second}</p>
        </div>
      )}
    </section>
  );
}
