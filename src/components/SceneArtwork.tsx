import Image from "next/image";
import { visualScenes, type VisualSceneId } from "@/lib/visual-scenes";

export default function SceneArtwork({
  scene,
  className = "",
  sizes = "(max-width:760px) 45vw, 320px",
  eager = false,
  preload = false,
}: {
  scene: VisualSceneId;
  className?: string;
  sizes?: string;
  eager?: boolean;
  preload?: boolean;
}) {
  return (
    <div className={`scene-artwork ${className}`} aria-hidden="true">
      <Image
        src={visualScenes[scene].src}
        alt=""
        fill
        sizes={sizes}
        loading={preload ? undefined : eager ? "eager" : "lazy"}
        preload={preload}
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}
