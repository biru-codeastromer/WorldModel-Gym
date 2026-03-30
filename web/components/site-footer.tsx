import Link from "next/link";

const columns = [
  {
    title: "Benchmark Links",
    links: [
      { label: "Homepage", href: "/" },
      { label: "Tasks", href: "/tasks" },
      { label: "Leaderboard", href: "/leaderboard" },
      { label: "GitHub Repo", href: "https://github.com/biru-codeastromer/WorldModel-Gym" }
    ]
  },
  {
    title: "Platform",
    links: [
      { label: "FastAPI Backend", href: "https://github.com/biru-codeastromer/WorldModel-Gym/tree/main/server" },
      { label: "Next.js Web", href: "https://github.com/biru-codeastromer/WorldModel-Gym/tree/main/web" },
      { label: "Mobile Viewer", href: "https://github.com/biru-codeastromer/WorldModel-Gym/tree/main/mobile" },
      { label: "Deployment Notes", href: "https://github.com/biru-codeastromer/WorldModel-Gym/blob/main/docs/DEPLOYMENT.md" }
    ]
  },
  {
    title: "Research Ops",
    links: [
      { label: "Evaluation Harness", href: "https://github.com/biru-codeastromer/WorldModel-Gym/tree/main/core" },
      { label: "Planner Baselines", href: "https://github.com/biru-codeastromer/WorldModel-Gym/tree/main/planners" },
      { label: "World Models", href: "https://github.com/biru-codeastromer/WorldModel-Gym/tree/main/worldmodels" },
      { label: "Runbook", href: "https://github.com/biru-codeastromer/WorldModel-Gym/blob/main/docs/OPERATIONS.md" }
    ]
  },
  {
    title: "Project Notes",
    links: [
      { label: "README", href: "https://github.com/biru-codeastromer/WorldModel-Gym/blob/main/README.md" },
      { label: "Security", href: "https://github.com/biru-codeastromer/WorldModel-Gym/blob/main/SECURITY.md" },
      { label: "Roadmap", href: "https://github.com/biru-codeastromer/WorldModel-Gym/blob/main/ROADMAP.md" },
      { label: "License", href: "https://github.com/biru-codeastromer/WorldModel-Gym/blob/main/LICENSE" }
    ]
  }
];

export function SiteFooter() {
  return (
    <footer className="site-shell pb-12 pt-4">
      <div className="site-soft-panel rounded-[34px] border border-[var(--line)] px-7 py-8 md:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_2fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--paper-strong)] text-lg font-semibold text-[var(--ink)]">
                W
              </div>
              <div>
                <p className="text-xl font-semibold text-[var(--ink)]">
                  WorldModel <span className="brand-accent">Gym</span>
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Factory-ready benchmark surfaces
                </p>
              </div>
            </div>
            <p className="mt-6 text-lg font-semibold text-[var(--ink)]">Build research demos that look finished.</p>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--muted)]">
              WorldModel Gym brings benchmark design, run upload, traces, and public leaderboard presentation into one
              clean product surface.
            </p>
            <p className="mt-8 text-sm italic text-[var(--muted)]">
              “Good benchmark software should feel as intentional as the paper it supports.”
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
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
                      <Link key={link.label} className="footer-link block text-sm leading-6" href={link.href}>
                        {link.label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
          <p>© 2026 WorldModel Gym. Built for research, demos, and portfolio-grade engineering.</p>
          <div className="flex flex-wrap gap-5">
            <a className="footer-link" href="https://github.com/biru-codeastromer/WorldModel-Gym" rel="noreferrer" target="_blank">
              GitHub
            </a>
            <a className="footer-link" href="https://world-model-gym.vercel.app" rel="noreferrer" target="_blank">
              Live Site
            </a>
            <a className="footer-link" href="https://worldmodel-gym-api.onrender.com/healthz" rel="noreferrer" target="_blank">
              API Health
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
