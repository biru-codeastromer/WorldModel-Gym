"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { fetchRun, fetchTrace } from "@/lib/api";

function normalizeEpisodes(trace: any[]) {
  if (trace.every((entry) => Array.isArray(entry?.steps))) {
    return trace;
  }
  return [
    {
      steps: trace.map((step: any, index) => ({
        ...step,
        t: step?.t ?? step?.step ?? index,
        events: Array.isArray(step?.events) ? step.events : []
      }))
    }
  ];
}

function extractEvents(trace: any[]) {
  const events: { t: number; name: string }[] = [];
  trace.forEach((episode) => {
    (episode.steps ?? []).forEach((step: any) => {
      (step.events ?? []).forEach((evt: string) => events.push({ t: step.t, name: evt }));
    });
  });
  return events;
}

export default function RunViewerPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;

  const runQuery = useQuery({ queryKey: ["run", runId], queryFn: () => fetchRun(runId) });
  const traceQuery = useQuery({ queryKey: ["trace", runId], queryFn: () => fetchTrace(runId) });

  const episodes = useMemo(() => normalizeEpisodes(traceQuery.data ?? []), [traceQuery.data]);
  const events = useMemo(() => extractEvents(episodes), [episodes]);
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
    return <div className="glass-panel rounded-[28px] p-6 shadow-card">Loading run viewer...</div>;
  }

  if (runQuery.isError || traceQuery.isError) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700 shadow-card">
        Unable to load run details.
      </div>
    );
  }

  const run = runQuery.data;
  const metrics = run?.metrics ?? {};
  const traceLines = episodes;

  return (
    <section className="space-y-5">
      <div className="glass-panel rounded-[30px] p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Run Viewer</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-ink">Run {runId}</h2>
        <p className="mt-3 text-sm text-slate-600">
          Agent: <strong>{run?.agent ?? "--"}</strong> | Env: <strong>{run?.env ?? "--"}</strong> | Track:{" "}
          <strong>{run?.track ?? "--"}</strong>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-panel rounded-[26px] p-4 shadow-card">
          <p className="text-xs uppercase text-slate-500">Success Rate</p>
          <p className="text-2xl font-semibold text-ink">{Number(metrics.success_rate ?? 0).toFixed(2)}</p>
        </div>
        <div className="glass-panel rounded-[26px] p-4 shadow-card">
          <p className="text-xs uppercase text-slate-500">Mean Return</p>
          <p className="text-2xl font-semibold text-ink">{Number(metrics.mean_return ?? 0).toFixed(2)}</p>
        </div>
        <div className="glass-panel rounded-[26px] p-4 shadow-card">
          <p className="text-xs uppercase text-slate-500">Model Fidelity (k1)</p>
          <p className="text-2xl font-semibold text-ink">{Number(metrics.model_fidelity?.k1 ?? 0).toFixed(3)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="glass-panel rounded-[28px] p-5 shadow-card">
          <h3 className="text-lg font-semibold text-ink">Episode Timeline</h3>
          <p className="mt-1 text-sm text-slate-500">Episodes logged: {traceLines.length}</p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {traceLines.map((ep: any, idx: number) => (
              <div key={idx} className="rounded-[18px] bg-white/80 p-3 font-mono text-xs text-ink">
                Episode {idx + 1}: {ep.steps?.length ?? 0} steps
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel rounded-[28px] p-5 shadow-card">
          <h3 className="text-lg font-semibold text-ink">Planner Visualization</h3>
          {firstPlanner ? (
            <pre className="mt-3 max-h-64 overflow-auto rounded-[20px] bg-slate-950 p-4 text-xs text-emerald-200">
              {JSON.stringify(firstPlanner, null, 2)}
            </pre>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No planner trace available for this run.</p>
          )}
        </article>
      </div>

      <article className="glass-panel rounded-[28px] p-5 shadow-card">
        <h3 className="text-lg font-semibold text-ink">Events</h3>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No semantic events recorded.</p>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {events.slice(0, 60).map((evt, idx) => (
              <li key={idx} className="rounded-[18px] border border-ink/10 bg-white/80 p-3 text-sm text-ink">
                t={evt.t}: {evt.name}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
