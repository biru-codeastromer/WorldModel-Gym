"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { fetchRun, fetchTrace } from "@/lib/api";

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

  const events = useMemo(() => extractEvents(traceQuery.data ?? []), [traceQuery.data]);
  const firstPlanner = useMemo(() => {
    const episodes = traceQuery.data ?? [];
    for (const ep of episodes) {
      for (const step of ep.steps ?? []) {
        if (step.planner && Object.keys(step.planner).length > 0) {
          return step.planner;
        }
      }
    }
    return null;
  }, [traceQuery.data]);

  if (runQuery.isLoading || traceQuery.isLoading) {
    return <div className="rounded-2xl bg-white p-6 shadow-card">Loading run viewer...</div>;
  }

  if (runQuery.isError || traceQuery.isError) {
    return <div className="rounded-2xl bg-red-50 p-6 text-red-700">Unable to load run details.</div>;
  }

  const metrics = runQuery.data.metrics ?? {};
  const traceLines = traceQuery.data ?? [];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="text-3xl font-semibold text-ink">Run {runId}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Agent: <strong>{runQuery.data.agent}</strong> | Env: <strong>{runQuery.data.env}</strong> | Track: <strong>{runQuery.data.track}</strong>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <p className="text-xs uppercase text-slate-500">Success Rate</p>
          <p className="text-2xl font-semibold text-ink">{Number(metrics.success_rate ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <p className="text-xs uppercase text-slate-500">Mean Return</p>
          <p className="text-2xl font-semibold text-ink">{Number(metrics.mean_return ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <p className="text-xs uppercase text-slate-500">Model Fidelity (k1)</p>
          <p className="text-2xl font-semibold text-ink">{Number(metrics.model_fidelity?.k1 ?? 0).toFixed(3)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-4 shadow-card">
          <h3 className="text-lg font-semibold text-ink">Episode Timeline</h3>
          <p className="mt-1 text-sm text-slate-500">Episodes logged: {traceLines.length}</p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {traceLines.map((ep: any, idx: number) => (
              <div key={idx} className="rounded-lg bg-cloud p-2 font-mono text-xs text-ink">
                Episode {idx + 1}: {ep.steps?.length ?? 0} steps
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl bg-white p-4 shadow-card">
          <h3 className="text-lg font-semibold text-ink">Planner Visualization</h3>
          {firstPlanner ? (
            <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-emerald-200">
              {JSON.stringify(firstPlanner, null, 2)}
            </pre>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No planner trace available for this run.</p>
          )}
        </article>
      </div>

      <article className="rounded-2xl bg-white p-4 shadow-card">
        <h3 className="text-lg font-semibold text-ink">Events</h3>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No semantic events recorded.</p>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {events.slice(0, 60).map((evt, idx) => (
              <li key={idx} className="rounded-lg border border-ink/10 bg-cloud p-2 text-sm text-ink">
                t={evt.t}: {evt.name}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
