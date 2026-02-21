import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/leaderboard", label: "Leaderboard" }
];

export function Nav() {
  return (
    <header className="mx-auto mt-4 w-full max-w-6xl rounded-2xl bg-white/85 p-4 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-ink">WorldModel Gym</h1>
        <nav className="flex gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-ink/10 bg-cloud px-4 py-2 text-sm font-medium text-ink transition hover:bg-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
