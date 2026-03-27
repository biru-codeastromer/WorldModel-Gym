"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { LeaderboardChart } from "@/components/leaderboard-chart";
import { fetchLeaderboard } from "@/lib/api";

const tracks = ["test", "train", "continual"];

export default function LeaderboardPage() {
  const [track, setTrack] = useState("test");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leaderboard", track],
    queryFn: () => fetchLeaderboard(track)
  });

  const rows = useMemo(() => data ?? [], [data]);
  const topSuccess = rows.length > 0 ? Math.max(...rows.map((row) => row.success_rate)) : 0;
  const fastestPlanner = rows.length > 0 ? Math.min(...rows.map((row) => row.planning_cost_ms_per_step)) : 0;

  return (
    <section className="space-y-5">
      <div className="glass-panel rounded-[30px] p-7 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Leaderboard</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-ink">Track planning quality, not just screenshots.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Compare runs by success rate, return, and per-step planning cost across reproducible benchmark tracks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-[24px] bg-white/85 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Runs</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{rows.length}</p>
            </div>
            <div className="rounded-[24px] bg-white/85 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Best Success</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{topSuccess.toFixed(2)}</p>
            </div>
            <div className="rounded-[24px] bg-white/85 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Fastest Cost</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{rows.length > 0 ? fastestPlanner.toFixed(2) : "--"}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {tracks.map((item) => (
            <button
              key={item}
              onClick={() => setTrack(item)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                track === item ? "bg-ink text-white" : "bg-white text-ink hover:-translate-y-0.5"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-[28px] p-6 shadow-card">
          <p className="text-sm font-medium text-slate-600">Loading leaderboard signals...</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="h-28 animate-pulse rounded-[22px] bg-white/80" />
            <div className="h-28 animate-pulse rounded-[22px] bg-white/80" />
            <div className="h-28 animate-pulse rounded-[22px] bg-white/80" />
          </div>
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">Live API unavailable</p>
          <h3 className="mt-2 text-2xl font-semibold text-amber-950">The frontend is up, but the backend URL is not serving leaderboard data.</h3>
          <p className="mt-3 text-sm leading-7 text-amber-900">
            {error instanceof Error ? error.message : "Failed to load leaderboard data."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
              Back to Home
            </Link>
            <Link
              href="/tasks"
              className="rounded-full border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-900"
            >
              Browse Tasks Instead
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <div className="glass-panel rounded-[28px] border border-dashed border-ink/20 p-8 text-center shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">No runs yet</p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">This track is waiting for its first uploaded evaluation.</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Run the demo pipeline or upload benchmark artifacts to populate charts, rankings, and individual run views.
          </p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <LeaderboardChart data={rows} />
          <div className="glass-panel overflow-x-auto rounded-[28px] p-5 shadow-card">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Run</th>
                  <th className="py-2">Env</th>
                  <th className="py-2">Agent</th>
                  <th className="py-2">Success</th>
                  <th className="py-2">Return</th>
                  <th className="py-2">Cost (ms/step)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.run_id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 font-mono text-xs">
                      <Link className="text-ember hover:underline" href={`/runs/${row.run_id}`}>
                        #{index + 1} {row.run_id}
                      </Link>
                    </td>
                    <td className="py-3">{row.env}</td>
                    <td className="py-3">{row.agent}</td>
                    <td className="py-3">{row.success_rate.toFixed(2)}</td>
                    <td className="py-3">{row.mean_return.toFixed(2)}</td>
                    <td className="py-3">{row.planning_cost_ms_per_step.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
