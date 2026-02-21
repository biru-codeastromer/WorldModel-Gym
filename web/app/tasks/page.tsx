import { fetchTasks } from "@/lib/api";

export default async function TasksPage() {
  try {
    const data = await fetchTasks();
    const tasks = data.tasks ?? [];

    return (
      <section className="space-y-4">
        <h2 className="text-3xl font-semibold text-ink">Task Browser</h2>
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/30 bg-white p-8 text-center text-slate-600">
            No tasks available.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {tasks.map((task: any) => (
              <article key={task.id} className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="text-xl font-semibold text-ink">{task.id}</h3>
                <p className="mt-2 text-sm text-slate-600">{task.description}</p>
                <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-emerald-200">
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
      <div className="rounded-2xl bg-white p-8 shadow-card">
        <h2 className="text-2xl font-semibold text-ink">Task Browser</h2>
        <p className="mt-2 text-sm text-red-600">Failed to load tasks. Verify backend availability.</p>
      </div>
    );
  }
}
