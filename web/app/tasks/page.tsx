import Link from "next/link";

import { fetchTasks, TaskRecord } from "@/lib/api";

const curatedTasks: TaskRecord[] = [
  {
    id: "memory_maze",
    description: "Navigate a key-door dependency chain under limited field of view and delayed reward.",
    defaults: { obs_mode: "both", reward_type: "sparse" }
  },
  {
    id: "switch_quest",
    description: "Discover and execute a hidden subgoal sequence with incomplete observations.",
    defaults: { obs_mode: "symbolic", chain_length: 4 }
  },
  {
    id: "craft_lite",
    description: "Plan over resource collection and crafting dependencies under tight budgets.",
    defaults: { inventory_limit: 6, sparse_mode: true }
  }
];

export default async function TasksPage() {
  const renderTaskCard = (task: TaskRecord, mode: "Live" | "Fallback") => (
    <article key={task.id} className="site-panel rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{task.id}</h3>
        <span className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {mode}
        </span>
      </div>
      <p className="mt-4 text-base leading-7 text-[var(--muted)]">{task.description}</p>
      <div className="mt-6 rounded-[22px] border border-[var(--line)] bg-[var(--sand)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Defaults</p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-[var(--font-mono)] text-xs leading-6 text-[var(--ink)]">
          {JSON.stringify(task.defaults ?? {}, null, 2)}
        </pre>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/upload?env=${encodeURIComponent(task.id)}&track=test`}
          className="button-primary px-4 py-3 text-sm font-semibold"
        >
          Upload Run
        </Link>
        <Link
          href="/leaderboard"
          className="button-secondary px-4 py-3 text-sm font-semibold"
        >
          Compare on Leaderboard
        </Link>
      </div>
    </article>
  );

  try {
    const data = await fetchTasks();
    const tasks = data.tasks ?? [];

    return (
      <section className="space-y-8">
        <section className="border-b border-t border-[var(--line)] py-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
            <div>
              <p className="section-kicker">Task browser</p>
              <h2 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-[var(--ink)]">
                Benchmark worlds with explicit failure modes and polished task framing.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                Each environment is packaged the same way a great product page would be: clean defaults, clear purpose,
                and enough context for someone to understand the benchmark before reading source code.
              </p>
            </div>

            <div className="site-panel paper-matrix rounded-[30px] p-6">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  "Sparse rewards with delayed payoff",
                  "Partial observability and memory pressure",
                  "Procedural seeds for transfer testing",
                  "Consistent task metadata for demos and papers"
                ].map((item) => (
                  <div key={item} className="site-soft-panel rounded-[18px] px-4 py-5 text-sm font-medium leading-6 text-[var(--ink)]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {tasks.length === 0 ? (
          <div className="site-panel rounded-[30px] border border-dashed border-[var(--line-strong)] p-10 text-center text-[var(--muted)]">
            No tasks available.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">{tasks.map((task) => renderTaskCard(task, "Live"))}</div>
        )}
      </section>
    );
  } catch {
    return (
      <section className="space-y-8">
        <section className="border-b border-t border-[var(--line)] py-10">
          <p className="section-kicker">Task browser</p>
          <h2 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-[var(--ink)]">
            Benchmark worlds with explicit failure modes and fallback-ready presentation.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            The live API is unavailable right now, so this page is showing curated benchmark metadata instead of live
            task discovery.
          </p>
        </section>
        <div className="rounded-[26px] border border-[var(--line-strong)] bg-[#f8ede1] px-5 py-4 text-sm text-[#7a5433]">
          Live task discovery failed. Check the backend deployment or `NEXT_PUBLIC_API_BASE`.
        </div>
        <div className="grid gap-4 xl:grid-cols-3">{curatedTasks.map((task) => renderTaskCard(task, "Fallback"))}</div>
      </section>
    );
  }
}
