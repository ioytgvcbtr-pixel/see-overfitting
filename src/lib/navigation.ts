export type AppView =
  | "explore"
  | "concepts"
  | "classification"
  | "studio"
  | "datasets"
  | "path"
  | "history"
  | "settings";
// Settings stays out of the learning route hierarchy.
export function viewFromHash(hash: string): AppView {
  const value = hash.replace(/^#/, "");
  if (!value) return "explore";
  return value === "explore" ||
    value === "concepts" ||
    value === "classification" ||
    value === "datasets" ||
    value === "path" ||
    value === "history" || value === "settings"
    ? value as AppView
    : "studio";
}
export function hashForView(view: AppView) {
  return `#${view}`;
}
