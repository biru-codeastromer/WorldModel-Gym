import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/leaderboard", label: "Leaderboard" }
];

export function Nav() {
  return (
    <header className="glass-panel mx-auto mt-4 w-full max-w-6xl rounded-[28px] px-5 py-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            World Models Research
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-ink">WorldModel Gym</h1>
        </div>
        <nav className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-ink/10 bg-white/80 px-4 py-2 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:bg-white"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/biru-codeastromer/WorldModel-Gym"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
