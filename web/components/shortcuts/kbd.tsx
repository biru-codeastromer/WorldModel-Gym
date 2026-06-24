"use client";

import { cn } from "@/components/ui";

/**
 * A single styled key chip — a token-themed, mono `<kbd>` that mirrors the ESC
 * chip already used in the command palette so the visual language stays
 * consistent. Used to render each key in the shortcuts help dialog.
 */
export function Kbd({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.6rem] select-none items-center justify-center rounded border border-border bg-surface-2 px-1.5 py-0.5",
        "font-mono text-[0.7rem] font-medium leading-none text-fg-muted shadow-sm",
        className
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * Renders an ordered list of keys as `<Kbd>` chips joined by a faint "+" so a
 * combo like ⌘ + K reads clearly. A single key renders as one chip.
 */
export function KbdCombo({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, i) => (
        <span key={`${key}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? (
            <span aria-hidden="true" className="text-[0.65rem] text-fg-subtle">
              +
            </span>
          ) : null}
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </span>
  );
}
