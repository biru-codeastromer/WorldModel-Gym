"use client";

import { useId, useState } from "react";

import { cn } from "./cn";

type TooltipProps = {
  /** Tooltip text content. */
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom";
  className?: string;
};

/**
 * Lightweight, dependency-free tooltip. Shows on hover AND keyboard focus, is
 * linked to its trigger via aria-describedby, and is dismissable. Wrap a single
 * focusable element. CSS-only positioning (no portals), so keep content short.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={() => setOpen(false)}
        aria-describedby={open ? id : undefined}
        className="inline-flex"
      >
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 font-mono text-xs leading-snug text-fg shadow-pop",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          className
        )}
      >
        {content}
      </span>
    </span>
  );
}
