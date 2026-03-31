"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/tasks", label: "Tasks" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/upload", label: "Upload" }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-[rgba(254,247,255,0.96)] font-[var(--font-mono)]">
      <div className="mx-auto flex min-h-[78px] max-w-[1320px] items-center justify-between gap-8 px-6 py-4 md:px-10 xl:px-12">
        <Link href="/" className="flex shrink-0 items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[var(--ink)] text-[1.35rem] font-semibold text-white">
            W
          </div>
          <div className="leading-none">
            <p className="text-[0.95rem] font-medium tracking-[-0.03em] text-[var(--ink)]">
              WorldModel Gym
            </p>
            <p className="mt-1 text-[0.62rem] uppercase tracking-[0.28em] text-[var(--muted)]">
              Research Benchmark Platform
            </p>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-7 text-sm text-[var(--ink)] lg:flex xl:gap-10">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname === link.href ? "is-active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-4">
          <a
            href="https://github.com/biru-codeastromer/WorldModel-Gym"
            target="_blank"
            rel="noreferrer"
            className="nav-link hidden lg:inline-flex"
          >
            GitHub
          </a>
          <Link
            href="/upload"
            className="button-primary px-5 py-2.5 text-sm font-medium"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/biru-codeastromer/WorldModel-Gym"
            target="_blank"
            rel="noreferrer"
            className="nav-link inline-flex lg:hidden"
          >
            GitHub
          </a>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-[rgba(254,247,255,0.92)] to-transparent" />
    </header>
  );
}
