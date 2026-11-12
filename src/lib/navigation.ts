export type AppView = "studio" | "datasets" | "path" | "history";
export function viewFromHash(hash: string): AppView {
  const value = hash.replace(/^#/, "");
  return value === "datasets" || value === "path" || value === "history"
    ? value
    : "studio";
}
export function hashForView(view: AppView) {
  return `#${view}`;
}
