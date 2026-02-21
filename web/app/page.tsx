import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-5 rounded-3xl bg-white/90 p-8 shadow-card">
      <p className="inline-block rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
        Imagination Benchmark
      </p>
      <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink">
        Evaluate long-horizon planning agents under sparse rewards, partial observability, and procedural generalization.
      </h2>
      <p className="max-w-3xl text-base text-slate-600">
        WorldModel Gym combines benchmark tasks, model-based planners, deterministic seed tracks, and a reproducible leaderboard platform.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/tasks" className="rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-white">
          Browse Tasks
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-full border border-ink/20 bg-white px-5 py-2.5 text-sm font-semibold text-ink"
        >
          Open Leaderboard
        </Link>
      </div>
      <div className="grid gap-4 pt-4 md:grid-cols-3">
        <article className="rounded-2xl border border-ink/10 bg-cloud p-4">
          <h3 className="font-semibold text-ink">MemoryMaze</h3>
          <p className="mt-2 text-sm text-slate-600">Key-door maze under limited FOV and delayed terminal reward.</p>
        </article>
        <article className="rounded-2xl border border-ink/10 bg-cloud p-4">
          <h3 className="font-semibold text-ink">SwitchQuest</h3>
          <p className="mt-2 text-sm text-slate-600">Discover and execute hidden subgoal chain in partial observations.</p>
        </article>
        <article className="rounded-2xl border border-ink/10 bg-cloud p-4">
          <h3 className="font-semibold text-ink">CraftLite</h3>
          <p className="mt-2 text-sm text-slate-600">Resource collection and crafting dependencies with strict sparse mode.</p>
        </article>
      </div>
    </section>
  );
}
