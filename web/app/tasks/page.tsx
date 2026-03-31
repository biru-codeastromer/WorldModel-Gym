import Image from "next/image";
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

const taskImages: Record<string, string> = {
  memory_maze: "/editorial/hero-goumbik.jpg",
  switch_quest: "/editorial/team-thirdman.jpg",
  craft_lite: "/editorial/chart-rdne.jpg"
};

function renderDefaultChips(defaults?: Record<string, unknown>) {
  const entries = Object.entries(defaults ?? {});
  if (entries.length === 0) {
    return <span className="text-sm text-[var(--muted)]">No defaults available</span>;
  }

  return entries.map(([key, value]) => (
    <span
      key={key}
      className="rounded-full border border-[rgba(185,174,195,0.42)] bg-[rgba(255,255,255,0.72)] px-3 py-2 text-xs text-[var(--muted)]"
    >
      {key}: <span className="text-[var(--ink)]">{String(value)}</span>
    </span>
  ));
}

function TaskCard({ task, mode }: { task: TaskRecord; mode: "Live" | "Fallback" }) {
  return (
    <article className="grid gap-6 border-t border-[rgba(185,174,195,0.46)] pt-6 lg:grid-cols-[0.42fr_0.58fr]">
      <div className="image-frame p-3">
        <div className="relative aspect-[1/0.82] overflow-hidden rounded-[24px]">
          <Image
            src={taskImages[task.id] ?? "/editorial/hero-goumbik.jpg"}
            alt={`${task.id} editorial visual`}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 26vw"
          />
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">{mode}</p>
          <span className="rounded-full border border-[rgba(185,174,195,0.42)] px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            {task.id}
          </span>
        </div>
        <h3 className="mt-4 font-[var(--font-serif)] text-4xl leading-[1.02] text-[var(--ink)]">{task.id}</h3>
        <p className="mt-4 max-w-xl text-base leading-8 text-[var(--muted)]">{task.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">{renderDefaultChips(task.defaults)}</div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`/upload?env=${encodeURIComponent(task.id)}&track=test`} className="button-primary px-5 py-3 text-sm font-semibold">
            Upload Run
          </Link>
          <Link href="/leaderboard" className="button-secondary px-5 py-3 text-sm font-semibold">
            Compare on Leaderboard
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function TasksPage() {
  try {
    const data = await fetchTasks();
    const tasks = data.tasks ?? [];

    return (
      <section className="space-y-14 pb-8">
        <section className="grid gap-12 border-b border-[rgba(185,174,195,0.46)] pb-16 pt-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <p className="section-kicker">Task browser</p>
            <h1 className="mt-8 font-[var(--font-serif)] text-6xl font-medium leading-[0.92] tracking-[-0.04em] text-[var(--ink)] md:text-7xl">
              Benchmark worlds with clear constraints and less presentation noise.
            </h1>
            <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
              Each environment is framed like a strong research product page: readable defaults, clear purpose, and
              direct paths into upload and leaderboard views.
            </p>
          </div>

          <div className="image-frame relative overflow-visible p-4">
            <div className="absolute -left-8 top-10 hidden h-[60%] w-[34%] rounded-[28px] border border-[rgba(61,104,220,0.38)] bg-[rgba(220,229,255,0.22)] lg:block" />
            <div className="grid gap-4 lg:grid-cols-[1.04fr_0.96fr]">
              <div className="relative aspect-[1/1.04] overflow-hidden rounded-[28px]">
                <Image
                  src="/editorial/team-thirdman.jpg"
                  alt="Team collaborating around charts"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 34vw"
                />
              </div>
              <div className="space-y-4">
                <div className="rounded-[26px] border border-[rgba(185,174,195,0.42)] bg-[rgba(255,255,255,0.74)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">What ships with every task</p>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink)]">
                    <p>Deterministic defaults</p>
                    <p>Track-ready metadata</p>
                    <p>Direct upload routing</p>
                    <p>Readable public benchmark framing</p>
                  </div>
                </div>
                <div className="relative aspect-[1/0.7] overflow-hidden rounded-[26px] border border-[rgba(185,174,195,0.42)] bg-[rgba(255,255,255,0.74)] p-3">
                  <div className="relative h-full w-full overflow-hidden rounded-[20px]">
                    <Image
                      src="/editorial/hero-goumbik.jpg"
                      alt="Desk with benchmark notebook and charts"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 22vw"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {tasks.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[rgba(185,174,195,0.7)] bg-[rgba(255,255,255,0.62)] px-8 py-12 text-center text-[var(--muted)]">
            No tasks available.
          </div>
        ) : (
          <div className="space-y-10">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} mode="Live" />
            ))}
          </div>
        )}
      </section>
    );
  } catch {
    return (
      <section className="space-y-12 pb-8">
        <section className="border-b border-[rgba(185,174,195,0.46)] pb-12 pt-8">
          <p className="section-kicker">Task browser</p>
          <h1 className="mt-8 max-w-4xl font-[var(--font-serif)] text-6xl font-medium leading-[0.94] tracking-[-0.04em] text-[var(--ink)] md:text-7xl">
            The live task registry is unavailable, so this page is showing curated benchmark worlds instead.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            The benchmark API is not returning live task metadata at the moment. You can still browse the fallback
            task definitions and upload runs against those known environments.
          </p>
        </section>
        <div className="rounded-[26px] border border-[rgba(215,160,111,0.62)] bg-[#fff1e4] px-5 py-4 text-sm text-[#7a5433]">
          Live task discovery failed. Check the backend deployment or `NEXT_PUBLIC_API_BASE`.
        </div>
        <div className="space-y-10">
          {curatedTasks.map((task) => (
            <TaskCard key={task.id} task={task} mode="Fallback" />
          ))}
        </div>
      </section>
    );
  }
}
