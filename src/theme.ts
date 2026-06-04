export type AppAppearance = "system" | "light" | "dark";

export function normalizeAppearance(value?: string | null): AppAppearance {
  return value === "system" || value === "light" || value === "dark"
    ? value
    : "dark";
}

export function applyAppearance(value?: string | null) {
  const root = document.documentElement;
  if (!root) return;
  root.dataset.theme = normalizeAppearance(value);
}
