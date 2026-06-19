import { useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light";
const LS_KEY = "mb_theme";

function readInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(LS_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light") root.classList.add("light");
  else root.classList.remove("light");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readInitial());

  useEffect(() => {
    apply(theme);
    try { localStorage.setItem(LS_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggle };
}
