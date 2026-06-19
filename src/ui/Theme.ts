/*
 * ui/Theme.ts — light/dark theme (spec §5). Dark is the default; on first visit
 * we follow `prefers-color-scheme`, and the user's explicit choice is remembered.
 */

const KEY = "logiclab:theme";
type Theme = "light" | "dark";

function apply(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("tb-theme");
  if (btn) {
    btn.textContent = theme === "dark" ? "☀" : "☾";
    btn.setAttribute("title", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
}

export function initTheme(): void {
  const saved = localStorage.getItem(KEY) as Theme | null;
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
  apply(saved ?? (prefersLight ? "light" : "dark"));

  document.getElementById("tb-theme")?.addEventListener("click", () => {
    const next: Theme = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    apply(next);
    localStorage.setItem(KEY, next);
  });
}
