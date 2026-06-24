"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { fetchRun, fetchTrace, formatMetric } from "@/lib/api";
import { extractEvents, normalizeEpisodes } from "@/lib/trace";
import type { TraceEpisode } from "@/lib/trace";

export default function RunViewerPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;

  const runQuery = useQuery({ queryKey: ["run", runId], queryFn: () => fetchRun(runId) });
  const traceQuery = useQuery({ queryKey: ["trace", runId], queryFn: () => fetchTrace(runId) });

  // normalizeEpisodes/extractEvents already tolerate malformed records, but wrap
  // them here too so a totally unexpected payload shape cannot throw during
  // render and white-screen the page.
  const episodes = useMemo<TraceEpisode[]>(() => {
    try {
      const raw = traceQuery.data;
      return normalizeEpisodes(Array.isArray(raw) ? raw : []);
    } catch {
      return [];
    }
  }, [traceQuery.data]);
  const events = useMemo(() => {
    try {
      return extractEvents(episodes);
    } catch {
      return [];
    }
  }, [episodes]);
  const firstPlanner = useMemo(() => {
    for (const ep of episodes) {
      for (const step of ep.steps ?? []) {
        if (step.planner && Object.keys(step.planner).length > 0) {
          return step.planner;
        }
      }
    }
    return null;
  }, [episodes]);

  if (runQuery.isLoading || traceQuery.isLoading) {
    return (
      <div className="rounded-[30px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.72)] p-8">
        Loading run viewer...
      </div>
    );
  }

  if (runQuery.isError || traceQuery.isError) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">
        Unable to load run details.
      </div>
    );
  }

  const run = runQuery.data;
  const metrics = run?.metrics ?? {};
  const traceLines = episodes;

  return (
    <section className="space-y-10 pb-8">
      <section className="border-b border-[rgba(185,174,195,0.46)] pb-12 pt-8">
        <p className="section-kicker">Run viewer</p>
        <h2 className="mt-8 font-[var(--font-serif)] text-6xl font-medium leading-[0.92] tracking-[-0.04em] text-[var(--ink)]">
          Run {runId}
        </h2>
        <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
          Agent: <strong>{run?.agent ?? "--"}</strong> | Env: <strong>{run?.env ?? "--"}</strong> | Track:{" "}
          <strong>{run?.track ?? "--"}</strong>
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/leaderboard" className="button-secondary px-5 py-3 text-sm font-semibold">
            Back to Leaderboard
          </Link>
          <Link href="/upload" className="button-primary px-5 py-3 text-sm font-semibold">
            Upload Another Run
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.74)] p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Success Rate</p>
          <p className="mt-3 font-[var(--font-serif)] text-5xl leading-none text-[var(--ink)]">
            {formatMetric(metrics.success_rate, 2)}
          </p>
        </div>
        <div className="rounded-[28px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.74)] p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Mean Return</p>
          <p className="mt-3 font-[var(--font-serif)] text-5xl leading-none text-[var(--ink)]">
            {formatMetric(metrics.mean_return, 2)}
          </p>
        </div>
        <div className="rounded-[28px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.74)] p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Model Fidelity (k1)</p>
          <p className="mt-3 font-[var(--font-serif)] text-5xl leading-none text-[var(--ink)]">
            {formatMetric(metrics.model_fidelity?.k1, 3)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[30px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.74)] p-6">
          <h3 className="font-[var(--font-serif)] text-4xl leading-none text-[var(--ink)]">Episode Timeline</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Episodes logged: {traceLines.length}</p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {traceLines.map((ep, idx) => (
              <div
                key={idx}
                className="rounded-[18px] border border-[rgba(185,174,195,0.42)] bg-[rgba(255,255,255,0.68)] p-3 font-mono text-xs text-[var(--ink)]"
              >
                Episode {idx + 1}: {ep.steps?.length ?? 0} steps
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[30px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.74)] p-6">
          <h3 className="font-[var(--font-serif)] text-4xl leading-none text-[var(--ink)]">Planner Visualization</h3>
          {firstPlanner ? (
            <pre className="mt-4 max-h-64 overflow-auto rounded-[20px] bg-[#18161d] p-4 text-xs text-[#f3ecff]">
              {JSON.stringify(firstPlanner, null, 2)}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">No planner trace available for this run.</p>
          )}
        </article>
      </div>

      <article className="rounded-[30px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.74)] p-6">
        <h3 className="font-[var(--font-serif)] text-4xl leading-none text-[var(--ink)]">Events</h3>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No semantic events recorded.</p>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {events.slice(0, 60).map((evt, idx) => (
              <li
                key={idx}
                className="rounded-[18px] border border-[rgba(185,174,195,0.42)] bg-[rgba(255,255,255,0.66)] p-3 text-sm text-[var(--ink)]"
              >
                t={evt.t}: {evt.name}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
