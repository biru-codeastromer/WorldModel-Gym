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
  try {
    const data = await fetchTasks();
    const tasks = data.tasks ?? [];

    return (
      <section className="space-y-5">
        <div className="glass-panel rounded-[30px] p-7 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Task Browser</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight text-ink">Benchmark worlds with explicit failure modes.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Each environment is designed to stress planning depth, memory, and transfer. Defaults are shown inline so
            visitors can understand the benchmark without reading the source first.
          </p>
        </div>

        {tasks.length === 0 ? (
          <div className="glass-panel rounded-[28px] border border-dashed border-ink/30 p-8 text-center text-slate-600">
            No tasks available.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {tasks.map((task) => (
              <article key={task.id} className="glass-panel rounded-[28px] p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-ink">{task.id}</h3>
                  <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                    Ready
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{task.description}</p>
                <pre className="mt-5 overflow-x-auto rounded-[22px] bg-slate-950 p-4 text-xs text-emerald-200">
                  {JSON.stringify(task.defaults ?? {}, null, 2)}
                </pre>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  } catch {
    return (
      <section className="space-y-5">
        <div className="glass-panel rounded-[30px] p-7 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Task Browser</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight text-ink">Benchmark worlds with explicit failure modes.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            The API is currently unavailable, so this page is showing curated benchmark metadata instead of live task
            discovery.
          </p>
        </div>
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-card">
          Live task discovery failed. Check the backend deployment or `NEXT_PUBLIC_API_BASE`.
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {curatedTasks.map((task) => (
            <article key={task.id} className="glass-panel rounded-[28px] p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-ink">{task.id}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Fallback
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{task.description}</p>
              <pre className="mt-5 overflow-x-auto rounded-[22px] bg-slate-950 p-4 text-xs text-emerald-200">
                {JSON.stringify(task.defaults ?? {}, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      </section>
    );
  }
}
