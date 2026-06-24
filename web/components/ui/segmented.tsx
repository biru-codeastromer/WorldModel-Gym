"use client";

import { useId, useRef } from "react";

import { cn } from "./cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
};

type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the tablist. */
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Accessible segmented control implemented as an ARIA tablist (role="tab" /
 * aria-selected). Arrow keys move selection (roving focus); the leaderboard
 * track switcher uses this. Pages should render their own panel and tie it via
 * aria-controls if needed — this component owns the tabs only.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className
}: SegmentedProps<T>) {
  const groupId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1",
        className
      )}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${groupId}-${opt.value}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "rounded-full font-mono font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              selected
                ? "bg-surface text-fg shadow-sm"
                : "text-fg-muted hover:text-fg"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
