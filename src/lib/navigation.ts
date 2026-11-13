export type AppView =
  "concepts" | "classification" | "studio" | "datasets" | "path" | "history";
export function viewFromHash(hash: string): AppView {
  const value = hash.replace(/^#/, "");
  if (!value) return "concepts";
  return value === "concepts" ||
    value === "classification" ||
    value === "datasets" ||
    value === "path" ||
    value === "history"
    ? value
    : "studio";
}
export function hashForView(view: AppView) {
  return `#${view}`;
}
