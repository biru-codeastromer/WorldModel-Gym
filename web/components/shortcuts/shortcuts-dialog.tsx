"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef } from "react";

import { KbdCombo } from "./kbd";
import { useIsMac } from "./use-platform";

type ShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Shortcut = { keys: string[]; label: string };
type ShortcutGroup = { title: string; items: Shortcut[] };

/**
 * Build the grouped shortcut list. Platform-aware: the command-palette /
 * theme-toggle modifier renders as ⌘ on macOS and Ctrl elsewhere. `isMac` comes
 * from a client-only hook so the symbol never causes a hydration mismatch.
 */
function buildGroups(isMac: boolean): ShortcutGroup[] {
  const mod = isMac ? "⌘" : "Ctrl";
  return [
    {
      title: "General",
      items: [
        { keys: [mod, "K"], label: "Open command palette" },
        { keys: ["?"], label: "Open this help" },
        { keys: ["Esc"], label: "Close dialog or palette" }
      ]
    },
    {
      title: "Navigation",
      items: [
        { keys: [mod, "K"], label: "Jump to any page" },
        { keys: ["↑", "↓"], label: "Move between palette results" },
        { keys: ["↵"], label: "Open the selected result" }
      ]
    },
    {
      title: "Theme",
      items: [{ keys: [mod, "K"], label: "Toggle light / dark (via palette)" }]
    }
  ];
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const reduce = useReducedMotion();
  const isMac = useIsMac();
  const titleId = useId();
  const descId = useId();

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // Remember what had focus before opening so we can restore it on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const groups = useMemo(() => buildGroups(isMac), [isMac]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Capture the trigger, lock body scroll, move focus into the dialog on open;
  // restore focus + scroll on close. Mirrors the command palette's lifecycle.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  // ESC to close + a focus trap so Tab cycles within the dialog.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh] sm:pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.16 }}
        >
          {/* Backdrop — click to dismiss. */}
          <button
            type="button"
            aria-label="Close keyboard shortcuts"
            tabIndex={-1}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-black/45 backdrop-blur-sm"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: reduce ? 0.12 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-[34rem] overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-mono text-[0.95rem] font-semibold text-fg"
                >
                  Keyboard shortcuts
                </h2>
                <p id={descId} className="mt-0.5 text-[0.78rem] text-fg-subtle">
                  Move around faster without leaving the keyboard.
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={close}
                aria-label="Close keyboard shortcuts"
                className="shrink-0 rounded-md border border-border bg-surface-2 p-1.5 text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[min(28rem,64vh)] space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
              {groups.map((group) => (
                <section key={group.title} aria-label={group.title}>
                  <h3 className="mb-2 font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
                    {group.title}
                  </h3>
                  <ul className="space-y-1">
                    {group.items.map((item, i) => (
                      <li
                        key={`${item.label}-${i}`}
                        className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5"
                      >
                        <span className="min-w-0 text-[0.85rem] text-fg-muted">
                          {item.label}
                        </span>
                        <KbdCombo keys={item.keys} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
