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
    <header className="site-shell sticky top-0 z-30 pt-5">
      <div className="flex items-center justify-between rounded-[999px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.72)] px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--ink)] font-[var(--font-serif)] text-lg font-semibold text-white">
            W
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-[var(--ink)]">
              WorldModel <span className="brand-accent">Gym</span>
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Research Benchmark Platform
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--muted)] md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`editorial-link ${pathname === link.href ? "text-[var(--ink)] !decoration-[rgba(29,26,36,0.55)]" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/upload"
            className="button-primary px-5 py-3 text-sm font-semibold"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/biru-codeastromer/WorldModel-Gym"
            target="_blank"
            rel="noreferrer"
            className="button-secondary px-4 py-3 text-sm font-semibold"
          >
            GitHub
          </a>
        </nav>

        <Link href="/upload" className="button-primary px-4 py-3 text-sm font-semibold md:hidden">
          Start
        </Link>
      </div>
    </header>
  );
}
