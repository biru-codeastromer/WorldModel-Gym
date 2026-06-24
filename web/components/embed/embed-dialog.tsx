"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { CodeBlock } from "@/components/docs";
import { cn } from "@/components/ui";

export type EmbedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Origin-relative badge path, e.g. "/runs/abc/badge". */
  badgePath: string;
  /** Origin-relative target the badge links to, e.g. "/runs/abc". */
  targetPath: string;
  /** Short human label used in the alt text + heading, e.g. "run abc". */
  subject: string;
};

/**
 * Resolve an absolute URL from an origin-relative path using the live browser
 * origin, so the snippets work when deployed (Vercel) rather than hard-coding a
 * host. Returns the path unchanged during SSR (origin is "") — the dialog only
 * renders client-side, so the empty-origin branch is effectively never shown.
 */
function absolute(origin: string, path: string): string {
  if (!origin) return path;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Accessible "Embed" dialog. Shows a live preview of the badge plus three
 * copy-able snippets — Markdown, HTML <img>, and the raw badge URL — each via
 * the design-system CodeBlock (whose copy button fires the shared toast). Mirrors
 * the focus-trap / Esc / scroll-lock lifecycle of the shortcuts dialog and stays
 * CSP-clean (no inline <script>; clipboard writes are bundled handlers).
 */
export function EmbedDialog({
  open,
  onOpenChange,
  badgePath,
  targetPath,
  subject
}: EmbedDialogProps) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const descId = useId();

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Origin is resolved on the client so absolute URLs are correct when deployed.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const badgeUrl = useMemo(() => absolute(origin, badgePath), [origin, badgePath]);
  const targetUrl = useMemo(() => absolute(origin, targetPath), [origin, targetPath]);

  const alt = `WorldModel Gym — ${subject}`;
  const snippets = useMemo(
    () => ({
      markdown: `[![${alt}](${badgeUrl})](${targetUrl})`,
      html: `<a href="${targetUrl}"><img src="${badgeUrl}" alt="${alt}" /></a>`,
      url: badgeUrl
    }),
    [alt, badgeUrl, targetUrl]
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Capture trigger, lock scroll, focus the close button on open; restore on close.
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

  // Esc to close + a Tab focus-trap that cycles within the dialog.
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
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[8vh] sm:pt-[10vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.16 }}
        >
          <button
            type="button"
            aria-label="Close embed dialog"
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
            className="relative z-10 flex max-h-[min(42rem,84vh)] w-full max-w-[36rem] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="font-mono text-[0.95rem] font-semibold text-fg">
                  Embed this badge
                </h2>
                <p id={descId} className="mt-0.5 text-[0.78rem] text-fg-subtle">
                  A live, self-updating badge for {subject}. Paste it into a README, page, or post.
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={close}
                aria-label="Close embed dialog"
                className="shrink-0 rounded-md border border-border bg-surface-2 p-1.5 text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 py-4">
              {/* Live preview */}
              <section aria-label="Badge preview">
                <h3 className="mb-2 font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
                  Preview
                </h3>
                <div className="flex items-center justify-center rounded-lg border border-border bg-surface-2 px-4 py-6 paper-matrix">
                  {/* Same-origin SVG (CSP img-src 'self'). The badge renders its
                      own brand colors, so it looks identical in light + dark. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgePath}
                    alt={alt}
                    height={28}
                    className="h-7 w-auto"
                    decoding="async"
                  />
                </div>
              </section>

              {/* Snippets */}
              <section aria-label="Embed snippets" className="mt-2">
                <SnippetRow label="markdown" code={snippets.markdown} />
                <SnippetRow label="html" code={snippets.html} />
                <SnippetRow label="badge url" code={snippets.url} />
              </section>

              <a
                href={targetPath}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md font-mono text-[0.72rem] text-fg-muted",
                  "transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Links to {targetUrl}
              </a>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SnippetRow({ label, code }: { label: string; code: string }) {
  return (
    <div className="mt-2 first:mt-0">
      <CodeBlock code={code} label={label} className="!my-2" />
    </div>
  );
}
