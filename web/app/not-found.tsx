import Link from "next/link";

export default function NotFound() {
  return (
    <section className="space-y-10 pb-8">
      <section className="border-b border-[rgba(185,174,195,0.46)] pb-12 pt-8">
        <p className="section-kicker">Page not found</p>
        <h1 className="mt-8 font-[var(--font-serif)] text-6xl font-medium leading-[0.92] tracking-[-0.04em] text-[var(--ink)] md:text-7xl">
          404 — this surface does not exist.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          The link may be stale, or the run you were looking for was never published. Pick a live surface below to get
          back on track.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="button-primary px-6 py-4 text-sm font-semibold">
            Back to Home
          </Link>
          <Link href="/leaderboard" className="button-secondary px-6 py-4 text-sm font-semibold">
            Open Leaderboard
          </Link>
          <Link href="/tasks" className="button-secondary px-6 py-4 text-sm font-semibold">
            Browse Tasks
          </Link>
        </div>
      </section>
    </section>
  );
}
