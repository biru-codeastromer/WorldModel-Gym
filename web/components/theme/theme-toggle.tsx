"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { useTheme } from "./theme-provider";
import type { Theme } from "./constants";

const ORDER: Theme[] = ["light", "dark", "system"];
const LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System"
};

/**
 * Cycles light -> dark -> system. Fully keyboard accessible (native <button>),
 * with an aria-label that announces the current mode and what activating it
 * will do. Renders a stable icon on the server (avoids hydration flicker) and
 * the real icon after mount.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? theme : "system";
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[current]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[current]}`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
