"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { SidebarNav, type SidebarGroup } from "./sidebar-nav";

/**
 * Mobile docs navigation: a top trigger that opens a drawer with the same
 * section nav as the desktop sidebar. Closes on route change and ESC, locks
 * body scroll, traps focus, and respects reduced-motion (instant, no slide).
 */
export function MobileNav({
  groups,
  currentTitle
}: {
  groups: SidebarGroup[];
  currentTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    // Capture the trigger node now so the cleanup restores focus to the same
    // element regardless of later ref changes.
    const trigger = triggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the panel.
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <span className="flex items-center gap-2.5">
          <BookText className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-fg-subtle">
            Docs
          </span>
          <span className="font-mono text-sm text-fg">{currentTitle}</span>
        </span>
        <span className="font-mono text-[0.7rem] text-fg-subtle">Menu</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Documentation navigation"
              className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-bg shadow-pop"
              initial={reduce ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={reduce ? { x: "-100%" } : { x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-fg-subtle">
                  Documentation
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-5">
                <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
