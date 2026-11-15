import type { IslandId } from "./island-learning";
import type { SceneId } from "./experiment";
export type WorkspaceEntry = {
  kind: "course" | "island" | "course_ai" | "island_ai" | "saved";
  id: string; title: string; stage: string; status: string; updated_at: string;
  panel?: IslandId; scene?: SceneId; attempt_id?: string; imported?: boolean; assisted?: boolean; needs_review: boolean;
};
export type WorkspaceOverview = {
  items: WorkspaceEntry[]; latest: WorkspaceEntry | null; completed_scenes: SceneId[];
  stats: {courses:number;island_rounds:number;needs_review:number};
};
export type ConnectionStatus = {state:"untested"|"ok"|"failed"|"disabled"|"unconfigured";checked_at:string|null;notice:string};
export type Health = {app:string;version:string;ai_configured:boolean;ai_model:string;connection:ConnectionStatus};
export function workspaceChanged() { window.dispatchEvent(new Event("fitlab-workspace-changed")); }
export function connectionLabel(value: ConnectionStatus | undefined) {
  return ({untested:"AI已配置",ok:"AI连接已验证",failed:"AI连接待检查",disabled:"规则讲解",unconfigured:"规则讲解"})[value?.state ?? "unconfigured"];
}
