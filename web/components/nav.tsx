"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/tasks", label: "Tasks" },
  { href: "/leaderboard", label: "Leaderboard" }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="site-shell sticky top-0 z-30 pt-4">
      <div className="site-panel flex items-center justify-between rounded-[22px] px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--paper-strong)] text-lg font-semibold text-[var(--ink)]">
            W
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-[var(--ink)]">
              WorldModel <span className="brand-accent">Gym</span>
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Research Benchmark Platform
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--muted)] md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition ${pathname === link.href ? "text-[var(--ink)]" : "hover:text-[var(--ink)]"}`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/leaderboard"
            className="button-primary px-5 py-3 text-sm font-semibold"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/biru-codeastromer/WorldModel-Gym"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--paper)]"
          >
            GitHub
          </a>
        </nav>

        <Link href="/leaderboard" className="button-primary px-4 py-3 text-sm font-semibold md:hidden">
          Start
        </Link>
      </div>
    </header>
  );
}
