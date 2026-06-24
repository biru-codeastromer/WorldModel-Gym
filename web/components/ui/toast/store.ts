import type { ToastApi, ToastInput, ToastItem, ToastTone } from "./types";

// ---------------------------------------------------------------------------
// Tiny framework-agnostic toast store.
//
// Toasts are notoriously awkward to drive from a hook alone: code often needs
// to fire one from an event handler, a mutation callback, or a non-component
// module. So state lives in a small external store and the `toast` singleton
// pushes into it imperatively. <ToastProvider> subscribes via
// useSyncExternalStore and renders. This keeps the public API (`toast.success`)
// usable from anywhere while staying a single source of truth.
// ---------------------------------------------------------------------------

const DEFAULT_DURATION = 4000;
const MAX_TOASTS = 4;

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  // Hand each subscriber a fresh array reference so React bails-out logic and
  // useSyncExternalStore see a new snapshot.
  for (const listener of listeners) {
    listener(toasts);
  }
}

function makeId(): string {
  // crypto.randomUUID is available in all our target runtimes (modern browsers
  // + Node 18+); fall back to a timestamp+random for older/edge cases.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ToastItem[] {
  return toasts;
}

/** Server snapshot — there are never any toasts during SSR. */
export function getServerSnapshot(): ToastItem[] {
  return EMPTY;
}
const EMPTY: ToastItem[] = [];

export function dismissToast(id: string) {
  clearTimer(id);
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function addToast(tone: ToastTone, input: ToastInput): string {
  const id = makeId();
  const duration = input.duration ?? DEFAULT_DURATION;
  const item: ToastItem = {
    id,
    tone,
    title: input.title,
    description: input.description,
    duration
  };

  // Cap the stack: drop the oldest if we're at the limit so a burst of toasts
  // never grows unbounded.
  const next = [...toasts, item];
  if (next.length > MAX_TOASTS) {
    const overflow = next.slice(0, next.length - MAX_TOASTS);
    for (const dropped of overflow) {
      clearTimer(dropped.id);
    }
    toasts = next.slice(next.length - MAX_TOASTS);
  } else {
    toasts = next;
  }
  emit();

  if (duration > 0) {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), duration)
    );
  }
  return id;
}

/**
 * The imperative singleton. Importable as `import { toast } from "@/components/ui"`
 * and callable from anywhere — event handlers, mutation callbacks, modules.
 */
export const toast: ToastApi = {
  success: (title, opts) => addToast("success", { title, ...opts }),
  error: (title, opts) => addToast("error", { title, ...opts }),
  info: (title, opts) => addToast("info", { title, ...opts }),
  dismiss: dismissToast
};
