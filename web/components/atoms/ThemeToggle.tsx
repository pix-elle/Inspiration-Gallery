"use client";

import { Moon, Sun } from "lucide-react";

// No React state here on purpose. The server can't know the visitor's theme,
// so any state-driven icon means rendering one icon, then swapping it after
// hydration — a visible flicker. Both icons are rendered instead, and CSS
// (see globals.css) shows exactly one, correct from the very first paint.
export function ThemeToggle() {
  function toggle() {
    const chosen = document.documentElement.dataset.theme;
    // No stored choice yet? Then we're mirroring the OS, and the toggle
    // switches away from whatever the OS is currently asking for.
    const isDark =
      chosen === "dark" ||
      (!chosen && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";

    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private browsing can refuse to store — the theme still applies to
      // this page, it just won't be remembered on the next visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Deliberately state-free wording: it stays true in both themes, so
      // screen readers never announce a label the icon contradicts.
      aria-label="Changer de thème"
      title="Changer de thème"
      className="text-foreground/60 transition-colors hover:text-foreground"
    >
      <Moon className="theme-icon-moon h-4 w-4" strokeWidth={1.5} aria-hidden />
      <Sun className="theme-icon-sun h-4 w-4" strokeWidth={1.5} aria-hidden />
    </button>
  );
}
