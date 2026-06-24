"use client";

import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Copy,
  Github,
  LayoutDashboard,
  ListChecks,
  Moon,
  Sun,
  Trophy,
  Upload as UploadIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useTheme } from "@/components/theme";
import { cn, toast } from "@/components/ui";
import { fetchLeaderboard, fetchTasks } from "@/lib/api";

const REPO = "https://github.com/biru-codeastromer/WorldModel-Gym";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// cmdk renders the group heading as a child with the `[cmdk-group-heading]`
// attribute; we style it via Tailwind arbitrary-child selectors so no global
// CSS is needed. The heading is hidden by cmdk when the group has no visible
// (filtered) items, so empty sections collapse cleanly.
const GROUP_CLASS =
  "mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[0.62rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-fg-subtle";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard, hint: "Home" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, hint: "Environments" },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, hint: "Rankings" },
  { href: "/upload", label: "Upload", icon: UploadIcon, hint: "Submit a run" }
] as const;

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { resolvedTheme, toggleTheme } = useTheme();
  const labelId = useId();
  const [search, setSearch] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Remember what had focus before we opened so we can restore it on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // --- Dynamic data ---------------------------------------------------------
  // Fetched lazily (only while the palette is open) and degrade gracefully:
  // an API error simply hides the dynamic sections rather than erroring out.
  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled: open,
    staleTime: 60_000
  });
  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", "test"],
    queryFn: () => fetchLeaderboard("test"),
    enabled: open,
    staleTime: 60_000
  });

  const tasks = tasksQuery.data?.tasks ?? [];
  const recentRuns = useMemo(
    () => (leaderboardQuery.data ?? []).slice(0, 6),
    [leaderboardQuery.data]
  );

  // --- Open / close lifecycle ----------------------------------------------
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Capture the trigger element, lock scroll, focus the input on open; restore
  // focus + scroll on close. Mirrors the Nav drawer's pattern.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus after the open animation frame so the input is mounted.
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  // Reset the search box each time the palette opens.
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  // ESC to close + a focus trap so Tab stays inside the dialog.
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

  // --- Action runners -------------------------------------------------------
  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  const copyLink = useCallback(() => {
    close();
    const url = typeof window !== "undefined" ? window.location.href : "";
    const done = () => toast.success("Link copied", { description: url });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done, () =>
        toast.error("Couldn't copy link", {
          description: "Your browser blocked clipboard access."
        })
      );
    } else {
      toast.error("Clipboard unavailable", {
        description: "This browser doesn't support copying."
      });
    }
  }, [close]);

  const openRepo = useCallback(() => {
    close();
    window.open(REPO, "_blank", "noopener,noreferrer");
  }, [close]);

  const onToggleTheme = useCallback(() => {
    toggleTheme();
    toast.info(
      resolvedTheme === "dark" ? "Switched to light theme" : "Switched to dark theme"
    );
  }, [toggleTheme, resolvedTheme]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.16 }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close command palette"
            tabIndex={-1}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-black/45 backdrop-blur-sm"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: reduce ? 0.12 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-[34rem] overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
          >
            <span id={labelId} className="sr-only">
              Command palette
            </span>
            <Command
              label="Command palette"
              // cmdk owns list filtering off the input value (shouldFilter).
              shouldFilter
              className="flex max-h-[min(28rem,70vh)] flex-col"
            >
              <div className="flex items-center gap-3 border-b border-border px-4">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-fg-subtle"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <Command.Input
                  ref={inputRef}
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search actions, environments, runs…"
                  className="h-12 w-full flex-1 border-0 bg-transparent font-mono text-[0.9rem] text-fg placeholder:text-fg-subtle focus:outline-none"
                />
                <kbd className="hidden shrink-0 select-none rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.62rem] text-fg-subtle sm:inline-block">
                  ESC
                </kbd>
              </div>

              <Command.List className="overflow-y-auto overscroll-contain p-2">
                <Command.Empty className="px-3 py-8 text-center font-mono text-[0.8rem] text-fg-subtle">
                  No results found.
                </Command.Empty>

                <Command.Group heading="Navigation" className={GROUP_CLASS}>
                  {NAV_ITEMS.map((item) => (
                    <PaletteItem
                      key={item.href}
                      icon={<item.icon className="h-4 w-4" aria-hidden="true" />}
                      label={item.label}
                      hint={item.hint}
                      keywords={[item.label, item.hint]}
                      onSelect={() => go(item.href)}
                    />
                  ))}
                </Command.Group>

                <Command.Group heading="Quick actions" className={GROUP_CLASS}>
                  <PaletteItem
                    icon={
                      resolvedTheme === "dark" ? (
                        <Sun className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Moon className="h-4 w-4" aria-hidden="true" />
                      )
                    }
                    label={
                      resolvedTheme === "dark"
                        ? "Switch to light theme"
                        : "Switch to dark theme"
                    }
                    keywords={["theme", "dark", "light", "toggle", "appearance"]}
                    onSelect={onToggleTheme}
                  />
                  <PaletteItem
                    icon={<Copy className="h-4 w-4" aria-hidden="true" />}
                    label="Copy current page link"
                    keywords={["copy", "link", "url", "share"]}
                    onSelect={copyLink}
                  />
                  <PaletteItem
                    icon={<Github className="h-4 w-4" aria-hidden="true" />}
                    label="Open GitHub repository"
                    keywords={["github", "source", "code", "repo"]}
                    onSelect={openRepo}
                  />
                </Command.Group>

                {tasks.length > 0 ? (
                  <Command.Group heading="Environments" className={GROUP_CLASS}>
                    {tasks.map((task) => (
                      <PaletteItem
                        key={task.id}
                        icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
                        label={task.id}
                        hint={task.description}
                        keywords={[task.id, task.description]}
                        onSelect={() => go("/tasks")}
                      />
                    ))}
                  </Command.Group>
                ) : null}

                {recentRuns.length > 0 ? (
                  <Command.Group heading="Recent runs" className={GROUP_CLASS}>
                    {recentRuns.map((run) => (
                      <PaletteItem
                        key={run.run_id}
                        icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                        label={`${run.agent} · ${run.env}`}
                        hint={run.run_id}
                        keywords={[run.agent, run.env, run.run_id, run.track]}
                        onSelect={() => go(`/runs/${run.run_id}`)}
                      />
                    ))}
                  </Command.Group>
                ) : null}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PaletteItem({
  icon,
  label,
  hint,
  keywords,
  onSelect
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  keywords?: (string | undefined)[];
  onSelect: () => void;
}) {
  return (
    <Command.Item
      // `value` drives cmdk's fuzzy filter; include keywords so a search for an
      // env id or run id surfaces the right row.
      value={[label, ...(keywords ?? [])].filter(Boolean).join(" ")}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-[0.85rem] text-fg-muted",
        "data-[selected=true]:bg-accent-soft data-[selected=true]:text-fg"
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-fg-subtle">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-fg">{label}</span>
      {hint ? (
        <span className="ml-auto shrink-0 truncate text-right font-mono text-[0.7rem] text-fg-subtle max-w-[45%]">
          {hint}
        </span>
      ) : null}
    </Command.Item>
  );
}
