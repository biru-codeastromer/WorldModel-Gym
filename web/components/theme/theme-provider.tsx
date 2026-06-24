"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { THEME_STORAGE_KEY, type ResolvedTheme, type Theme } from "./constants";

type ThemeContextValue = {
  /** The user's selected preference: "light" | "dark" | "system". */
  theme: Theme;
  /** The concrete theme currently applied: "light" | "dark". */
  resolvedTheme: ResolvedTheme;
  /** Persist a new preference and apply it immediately. */
  setTheme: (theme: Theme) => void;
  /** Convenience toggle between light <-> dark (resolves "system" first). */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

function apply(resolved: ResolvedTheme) {
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.style.colorScheme = resolved;
}

/**
 * Hand-rolled theme provider (no next-themes) so we fully control the inline
 * init script and keep it nonce-tagged for the CSP. The pre-paint class is set
 * by <ThemeScript> in the root layout; this provider keeps React state in sync,
 * persists changes, and reacts to OS changes when in "system" mode.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with "system" on both server and first client render to avoid a
  // hydration mismatch; the real value is read in an effect.
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // Hydrate from storage after mount.
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    setResolvedTheme(resolve(stored));
  }, []);

  // React to OS scheme changes while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolvedTheme(next);
      apply(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Keep other tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = readStoredTheme();
      setThemeState(next);
      const r = resolve(next);
      setResolvedTheme(r);
      apply(r);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    const r = resolve(next);
    setResolvedTheme(r);
    apply(r);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const currentResolved = resolve(current);
      const next: Theme = currentResolved === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      setResolvedTheme(next);
      apply(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}
