/** Marketing site light/dark theme (homepage + public pages). */

export type MkTheme = "dark" | "light";

const STORAGE_KEY = "fde-mk-theme";

export function readMkTheme(): MkTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function writeMkTheme(theme: MkTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function applyMkTheme(theme: MkTheme): void {
  document.documentElement.dataset.mkTheme = theme;
  document.querySelectorAll(".mk-home").forEach((el) => {
    el.classList.toggle("is-light", theme === "light");
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f4f4f5" : "#0a0a0b");
}
