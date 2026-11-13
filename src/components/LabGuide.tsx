import Image from "next/image";
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
      <Image
        src="/illustrations/fitlab-guide-v1.png"
        alt=""
        width={82}
        height={75}
        sizes="82px"
      />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}
