import Link from "next/link";

const pillars = [
  {
    title: "Benchmark Tracks",
    value: "3",
    detail: "test, train, continual"
  },
  {
    title: "Core Tasks",
    value: "3",
    detail: "MemoryMaze, SwitchQuest, CraftLite"
  },
  {
    title: "Stack",
    value: "Full",
    detail: "Gym + FastAPI + Next.js + mobile"
  }
];

const workflow = [
  "Generate controlled worlds with deterministic seeds",
  "Run planning agents with explicit compute budgets",
  "Upload metrics and traces into a public leaderboard"
];

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="glass-panel rounded-[34px] p-8 shadow-card">
          <p className="inline-flex rounded-full bg-ink px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.26em] text-white">
            Imagination Benchmark
          </p>
          <h2 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-ink md:text-6xl">
            Evaluate long-horizon planning agents with a benchmark that actually looks like research software.
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            WorldModel Gym combines procedurally generated tasks, reproducible evaluation tracks, and a public-facing
            leaderboard for imagination-based agents.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/tasks"
              className="rounded-full bg-ember px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Explore Tasks
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-full border border-ink/15 bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
            >
              View Leaderboard
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {pillars.map((pillar) => (
              <article key={pillar.title} className="rounded-[24px] border border-ink/10 bg-white/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{pillar.title}</p>
                <p className="mt-3 text-3xl font-semibold text-ink">{pillar.value}</p>
                <p className="mt-2 text-sm text-slate-600">{pillar.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="glass-panel rounded-[30px] p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Pipeline</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">From environment to leaderboard</h3>
            <div className="mt-5 space-y-3">
              {workflow.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-[22px] bg-white/80 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-accent rounded-[30px] border border-white/70 p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Why it matters</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Built for demos, papers, and recruiter screens.</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              The platform connects benchmark design, planner traces, and deployment-ready tooling so the project reads
              as both research and product engineering.
            </p>
          </div>
        </aside>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="glass-panel rounded-[30px] p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Benchmark Modes</p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">Designed for generalization pressure</h3>
          <div className="mt-5 space-y-3">
            <div className="rounded-[22px] bg-white/80 p-4">
              <p className="font-semibold text-ink">Sparse rewards</p>
              <p className="mt-2 text-sm text-slate-600">Agents need planning discipline instead of reward shaping shortcuts.</p>
            </div>
            <div className="rounded-[22px] bg-white/80 p-4">
              <p className="font-semibold text-ink">Partial observability</p>
              <p className="mt-2 text-sm text-slate-600">Tasks demand memory, belief updates, and structured search behavior.</p>
            </div>
            <div className="rounded-[22px] bg-white/80 p-4">
              <p className="font-semibold text-ink">Procedural seeds</p>
              <p className="mt-2 text-sm text-slate-600">Runs stay reproducible while still stressing transfer and robustness.</p>
            </div>
          </div>
        </article>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="glass-panel rounded-[28px] p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Task</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">MemoryMaze</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Key-door maze under limited field of view and delayed terminal rewards.</p>
          </article>
          <article className="glass-panel rounded-[28px] p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Task</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">SwitchQuest</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Hidden subgoal chaining where the agent must infer the correct sequence.</p>
          </article>
          <article className="glass-panel rounded-[28px] p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Task</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">CraftLite</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Resource planning with dependency structure, sparse rewards, and strict budgets.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
