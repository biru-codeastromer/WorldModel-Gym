"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { LeaderboardChart } from "@/components/leaderboard-chart";
import { fetchLeaderboard } from "@/lib/api";

const tracks = ["test", "train", "continual"];

export default function LeaderboardPage() {
  const [track, setTrack] = useState("test");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["leaderboard", track],
    queryFn: () => fetchLeaderboard(track)
  });

  const rows = useMemo(() => data ?? [], [data]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-semibold text-ink">Leaderboard</h2>
        <div className="flex flex-wrap gap-2">
          {tracks.map((item) => (
            <button
              key={item}
              onClick={() => setTrack(item)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${track === item ? "bg-ink text-white" : "bg-white text-ink"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <p className="rounded-xl bg-white p-4 text-slate-600">Loading leaderboard...</p> : null}
      {isError ? <p className="rounded-xl bg-red-50 p-4 text-red-600">Failed to load leaderboard.</p> : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/30 bg-white p-8 text-center text-slate-600">
          No uploaded runs for this track yet.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <LeaderboardChart data={rows} />
          <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-card">
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
                {rows.map((row) => (
                  <tr key={row.run_id} className="border-b border-slate-100">
                    <td className="py-3 font-mono text-xs">
                      <Link className="text-ember hover:underline" href={`/runs/${row.run_id}`}>
                        {row.run_id}
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
