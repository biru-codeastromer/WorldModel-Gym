import { Github } from "lucide-react";
import Link from "next/link";

import { GridWorld } from "@/components/visuals";

const REPO = "https://github.com/biru-codeastromer/WorldModel-Gym";

const columns = [
  {
    title: "Benchmark",
    links: [
      { label: "Overview", href: "/" },
      { label: "Tasks", href: "/tasks" },
      { label: "Leaderboard", href: "/leaderboard" },
      { label: "Upload", href: "/upload" }
    ]
  },
  {
    title: "Platform",
    links: [
      { label: "FastAPI Backend", href: `${REPO}/tree/main/server` },
      { label: "Next.js Web", href: `${REPO}/tree/main/web` },
      { label: "Mobile Viewer", href: `${REPO}/tree/main/mobile` },
      { label: "Deployment Notes", href: `${REPO}/blob/main/docs/DEPLOYMENT.md` }
    ]
  },
  {
    title: "Research Ops",
    links: [
      { label: "Evaluation Harness", href: `${REPO}/tree/main/core` },
      { label: "Planner Baselines", href: `${REPO}/tree/main/planners` },
      { label: "World Models", href: `${REPO}/tree/main/worldmodels` },
      { label: "Runbook", href: `${REPO}/blob/main/docs/OPERATIONS.md` }
    ]
  },
  {
    title: "Project",
    links: [
      { label: "README", href: `${REPO}/blob/main/README.md` },
      { label: "Security", href: `${REPO}/blob/main/SECURITY.md` },
      { label: "Roadmap", href: `${REPO}/blob/main/ROADMAP.md` },
      { label: "License", href: `${REPO}/blob/main/LICENSE` }
    ]
  }
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bg-soft">
      <div className="mx-auto w-full max-w-[1320px] px-5 pb-12 pt-14 md:px-8 xl:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1.9fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-fg font-mono text-lg font-semibold text-bg">
                W
              </span>
              <div>
                <p className="font-serif text-xl text-fg">
                  WorldModel <span className="brand-accent">Gym</span>
                </p>
                <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-fg-subtle">
                  Research Benchmark Platform
                </p>
              </div>
            </div>
            <p className="mt-6 max-w-sm font-mono text-sm leading-7 text-fg-muted">
              A reproducible benchmark and public leaderboard for long-horizon
              planning agents under sparse rewards and partial observability.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <div className="h-20 w-20 rounded-lg border border-border bg-surface p-2">
                <GridWorld size={6} className="h-full w-full" />
              </div>
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
                aria-label="GitHub repository"
              >
                <Github className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                  {column.title}
                </p>
                <div className="mt-4 space-y-3">
                  {column.links.map((link) =>
                    link.href.startsWith("http") ? (
                      <a
                        key={link.label}
                        className="footer-link block text-sm leading-6"
                        href={link.href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.label}
                        className="footer-link block text-sm leading-6"
                        href={link.href}
                      >
                        {link.label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 font-mono text-xs text-fg-subtle">
          <p>© 2026 WorldModel Gym. Built for research, demos, and portfolio-grade engineering.</p>
          <div className="flex flex-wrap gap-5">
            <a className="footer-link" href={REPO} rel="noreferrer" target="_blank">
              GitHub
            </a>
            <a className="footer-link" href="https://world-model-gym.vercel.app" rel="noreferrer" target="_blank">
              Live Site
            </a>
            <a
              className="footer-link"
              href="https://worldmodel-gym-api.onrender.com/healthz"
              rel="noreferrer"
              target="_blank"
            >
              API Health
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
