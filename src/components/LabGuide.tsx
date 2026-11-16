import PetAvatar from "./planet/PetAvatar";
import type { ReactNode } from "react";

export default function LabGuide({
  title = "观察提示",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="lab-guide" aria-label={title}>
      <PetAvatar motion={false} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}
