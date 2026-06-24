"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Github, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui";

const REPO = "https://github.com/biru-codeastromer/WorldModel-Gym";

const links = [
  { href: "/", label: "Overview" },
  { href: "/tasks", label: "Tasks" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/upload", label: "Upload" },
  { href: "/docs", label: "Docs" }
];

/**
 * Active-state match. Section links use exact match; routes with sub-pages
 * (e.g. /docs/quickstart) keep their nav item active via a prefix match so the
 * "Docs" link highlights across the whole docs tree. "/" stays exact so it
 * never lights up on every route.
 */
function isLinkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-fg text-[1.15rem] font-semibold text-bg">
        W
      </span>
      <span className="leading-none">
        <span className="block font-mono text-[0.9rem] font-medium tracking-[-0.02em] text-fg">
          WorldModel Gym
        </span>
        <span className="mt-1 block font-mono text-[0.58rem] uppercase tracking-[0.26em] text-fg-subtle">
          Research Benchmark
        </span>
      </span>
    </Link>
  );
}

/**
 * Compact ⌘K affordance shown in the Nav. Opens the command palette and mirrors
 * the platform-appropriate modifier glyph (⌘ on Apple, Ctrl elsewhere) once
 * mounted client-side. Full pill on desktop, an icon-only button on mobile.
 */
function CommandKHint() {
  const { setOpen } = useCommandPalette();
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    // Detect after mount to avoid hydration mismatch; default to Ctrl on SSR.
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform || navigator.platform;
    setIsApple(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        aria-keyshortcuts={isApple ? "Meta+K" : "Control+K"}
        className="hidden h-9 items-center gap-2 rounded-full border border-border bg-surface pl-3 pr-2 text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg lg:inline-flex"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-mono text-[0.72rem]">Search</span>
        <kbd className="ml-1 inline-flex items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.62rem] leading-none text-fg-subtle">
          <span aria-hidden="true">{isApple ? "⌘" : "Ctrl"}</span>K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close the drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body scroll lock + ESC + focus trap while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-6 px-5 md:h-[76px] md:px-8 xl:px-10">
        <Logo />

        <nav
          aria-label="Primary"
          className="hidden flex-1 items-center justify-center gap-7 lg:flex xl:gap-9"
        >
          {links.map((link) => {
            const isActive = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`nav-link ${isActive ? "is-active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <CommandKHint />
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-border-strong hover:text-fg lg:inline-flex"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
          </a>
          <ThemeToggle />
          <Link href="/upload" className="hidden sm:inline-flex">
            <Button size="sm">Get Started</Button>
          </Link>

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:text-fg lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          >
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 h-full w-full cursor-default bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              ref={panelRef}
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              initial={{ x: reduce ? 0 : "100%" }}
              animate={{ x: 0 }}
              exit={{ x: reduce ? 0 : "100%" }}
              transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col gap-1 border-l border-border bg-surface p-5 shadow-pop"
            >
              <div className="flex items-center justify-between pb-4">
                <Logo />
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:text-fg"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <nav aria-label="Mobile" className="flex flex-col">
                {links.map((link) => {
                  const isActive = isLinkActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`rounded-md px-3 py-3 font-mono text-base transition-colors ${
                        isActive
                          ? "bg-accent-soft text-accent"
                          : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                <a
                  href={REPO}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md px-3 py-3 font-mono text-base text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <Github className="h-4 w-4" aria-hidden="true" />
                  GitHub
                </a>
              </nav>

              <div className="mt-auto pt-5">
                <Link href="/upload" className="block">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
