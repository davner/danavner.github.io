import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

/**
 * What the browser paints its own chrome with, stamped onto the `theme-color`
 * meta. The hex pair lives here and in the pre-paint script in `index.html`,
 * which cannot import this module. Dark is the shipped chrome value; light is
 * the newsprint background token.
 */
const THEME_COLOR: Record<Theme, string> = { dark: "#0a0c12", light: "#f6f3ed" };

/**
 * The inline script in `index.html` sets the class before first paint; this
 * module just reads back whatever it decided and keeps the two in sync.
 */
let current: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function setTheme(theme: Theme) {
  current = theme;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing or blocked storage - the theme still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => "dark" as Theme,
  );
  return { theme, setTheme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark") };
}
