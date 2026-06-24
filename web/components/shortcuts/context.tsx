"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import { ShortcutsDialog } from "./shortcuts-dialog";

type ShortcutsHelpContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const ShortcutsHelpContext = createContext<ShortcutsHelpContextValue | null>(null);

/**
 * Returns true when the keystroke originated from a text-entry context we must
 * not hijack (inputs, textareas, selects, or any contenteditable host).
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * Owns the shortcuts-help dialog open state and the global "?" shortcut, and
 * mounts the dialog itself. Wrapped once in <Providers> so any component (e.g.
 * the command palette) can open the dialog via `useShortcutsHelp()`.
 */
export function ShortcutsProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // "?" is Shift+"/" on most layouts. Only fire when the user is NOT typing
      // and no command/ctrl/alt modifier is held (Shift is expected for "?").
      if (e.key !== "?") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo<ShortcutsHelpContextValue>(
    () => ({ open, setOpen }),
    [open]
  );

  return (
    <ShortcutsHelpContext.Provider value={value}>
      {children}
      <ShortcutsDialog open={open} onOpenChange={setOpen} />
    </ShortcutsHelpContext.Provider>
  );
}

export function useShortcutsHelp(): ShortcutsHelpContextValue {
  const ctx = useContext(ShortcutsHelpContext);
  if (!ctx) {
    throw new Error("useShortcutsHelp must be used within <ShortcutsProvider>");
  }
  return ctx;
}
