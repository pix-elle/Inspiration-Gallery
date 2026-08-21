"use client";

import { Moon, Sun } from "lucide-react";

// No React state here on purpose. The server can't know the visitor's theme,
// so a state-driven switch would render its knob on one side and slide it to
// the other after hydration. The knob position and the icon both come from
// CSS variables (see globals.css) — correct from the very first paint.
//
// It stays a plain <button> rather than role="switch": a switch must expose
// aria-checked, and at render time that value is genuinely unknown. A button
// labelled "Changer de thème" is true in either theme.
export function ThemeToggle() {
  function toggle() {
    const chosen = document.documentElement.dataset.theme;
    // No stored choice yet? Then we're mirroring the OS, and the switch flips
    // away from whatever the OS is currently asking for.
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
      aria-label="Changer de thème"
      title="Changer de thème"
      className="flex h-5 w-9 shrink-0 items-center rounded-full bg-foreground/15 px-0.5 transition-colors hover:bg-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
    >
      <span className="theme-switch-knob flex h-4 w-4 items-center justify-center rounded-full bg-background text-foreground/70 shadow-sm motion-safe:transition-transform motion-safe:duration-200">
        <Moon className="theme-icon-moon h-2.5 w-2.5" aria-hidden />
        <Sun className="theme-icon-sun h-2.5 w-2.5" aria-hidden />
      </span>
    </button>
  );
}
