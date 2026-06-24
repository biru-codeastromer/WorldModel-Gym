"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "../cn";
import {
  dismissToast,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  toast
} from "./store";
import type { ToastApi, ToastItem, ToastTone } from "./types";

const ICONS: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info
};

const ACCENT: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-accent"
};

/**
 * The public hook. It returns the same singleton API the `toast` export wraps,
 * so components can do `const t = useToast(); t.success("Saved")`. Both paths
 * write to the same store, so usage is interchangeable.
 */
export function useToast(): ToastApi {
  return toast;
}

function ToastCard({ item }: { item: ToastItem }) {
  const reduce = useReducedMotion();
  const Icon = ICONS[item.tone];
  return (
    <motion.li
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: reduce ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto w-[min(92vw,22rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-pop"
    >
      <div className="flex items-start gap-3 p-3.5">
        <Icon
          className={cn("mt-0.5 h-4 w-4 shrink-0", ACCENT[item.tone])}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.82rem] font-medium leading-snug text-fg">
            {item.title}
          </p>
          {item.description ? (
            <p className="mt-1 text-[0.8rem] leading-snug text-fg-muted">
              {item.description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => dismissToast(item.id)}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </motion.li>
  );
}

/**
 * Renders the toast viewport. Mounted once (via <Providers>), it subscribes to
 * the external store and paints the stack into a fixed, aria-live region so
 * screen readers announce new toasts politely without stealing focus.
 */
export function ToastProvider() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      // role=region + aria-live so assistive tech announces additions. polite =
      // it waits for a pause rather than interrupting. The container is always
      // present (even when empty) so the live region is established up front.
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:px-6"
    >
      <ul className="flex w-full max-w-[min(92vw,22rem)] flex-col gap-2.5 sm:w-auto">
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <ToastCard key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
