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
    <section className="space-y-8">
      <section className="border-b border-t border-[var(--line)] py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="section-kicker">Leaderboard</p>
            <h2 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-[var(--ink)]">
              Track planning quality with the same finish as a product launch page.
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">
              Compare runs by success rate, return, and per-step planning cost across reproducible benchmark tracks.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="site-panel rounded-[22px] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Runs</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">{rows.length}</p>
            </div>
            <div className="site-panel rounded-[22px] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Best Success</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">{topSuccess.toFixed(2)}</p>
            </div>
            <div className="site-panel rounded-[22px] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Fastest Cost</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {rows.length > 0 ? fastestPlanner.toFixed(2) : "--"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 md:grid-cols-3">
        {tracks.map((item) => (
          <button
            key={item}
            onClick={() => setTrack(item)}
            className={`eyebrow-tab ${track === item ? "is-active" : ""}`}
          >
            {item}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="site-panel rounded-[30px] p-6">
          <p className="text-sm font-medium text-[var(--muted)]">Loading leaderboard signals...</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="h-28 animate-pulse rounded-[22px] bg-[var(--sand)]" />
            <div className="h-28 animate-pulse rounded-[22px] bg-[var(--sand)]" />
            <div className="h-28 animate-pulse rounded-[22px] bg-[var(--sand)]" />
          </div>
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-[30px] border border-[var(--line-strong)] bg-[#f8ede1] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9b6b40]">Live API unavailable</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#4e3218]">
            The frontend theme is live, but the backend URL is not serving leaderboard data.
          </h3>
          <p className="mt-4 text-base leading-7 text-[#7c5330]">
            {error instanceof Error ? error.message : "Failed to load leaderboard data."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/" className="button-primary px-5 py-3 text-sm font-semibold">
              Back to Home
            </Link>
            <Link
              href="/tasks"
              className="button-secondary px-5 py-3 text-sm font-semibold"
            >
              Browse Tasks Instead
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <div className="site-panel rounded-[30px] border border-dashed border-[var(--line-strong)] p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">No runs yet</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            This track is waiting for its first uploaded evaluation.
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Run the demo pipeline or upload benchmark artifacts to populate charts, rankings, and individual run views.
          </p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <LeaderboardChart data={rows} />
          <div className="site-panel overflow-x-auto rounded-[30px] p-5">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
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
                  <tr key={row.run_id} className="border-b border-[var(--line)]/70 last:border-b-0">
                    <td className="py-3 font-mono text-xs">
                      <Link className="text-[var(--ink)] underline-offset-4 hover:underline" href={`/runs/${row.run_id}`}>
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
