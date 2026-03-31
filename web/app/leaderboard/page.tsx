"use client";

import Image from "next/image";
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
    <section className="space-y-12 pb-8">
      <section className="grid gap-12 border-b border-[rgba(185,174,195,0.46)] pb-16 pt-8 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="max-w-xl">
          <p className="section-kicker">Leaderboards</p>
          <h1 className="mt-8 font-[var(--font-serif)] text-6xl font-medium leading-[0.92] tracking-[-0.04em] text-[var(--ink)] md:text-7xl">
            Rigorous benchmark rankings, not cherry-picked result slides.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
            Compare planning quality, return, and per-step cost across live benchmark tracks, then jump directly into
            the run that produced each row.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="stat-chip">{rows.length} live runs</span>
            <span className="stat-chip">Best success {topSuccess.toFixed(2)}</span>
            <span className="stat-chip">
              Fastest {rows.length > 0 ? `${fastestPlanner.toFixed(2)} ms/step` : "--"}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
          <div className="relative aspect-[0.88/1] overflow-hidden rounded-[28px]">
            <Image
              src="/editorial/market-pixabay.jpg"
              alt="Market data board representing live benchmark comparison"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 30vw"
            />
          </div>
          <div className="space-y-6">
            <div className="border-t border-[rgba(185,174,195,0.42)] pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Read the signal</p>
              <p className="mt-4 font-[var(--font-serif)] text-3xl leading-[1.08] text-[var(--ink)]">
                Switch tracks, compare runs, and inspect evidence without leaving the site.
              </p>
            </div>
            <div className="relative aspect-[1/0.66] overflow-hidden rounded-[26px]">
              <Image
                src="/editorial/chart-rdne.jpg"
                alt="Soft research chart inset"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 20vw"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-6 border-b border-[rgba(185,174,195,0.46)] pb-3">
        {tracks.map((item) => (
          <button
            key={item}
            onClick={() => setTrack(item)}
            className={`eyebrow-tab px-0 pb-3 text-left text-base ${track === item ? "is-active" : ""}`}
          >
            {item}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-56 animate-pulse rounded-[30px] bg-[rgba(255,255,255,0.6)]" />
          <div className="h-72 animate-pulse rounded-[30px] bg-[rgba(255,255,255,0.55)]" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-[30px] border border-[rgba(215,160,111,0.62)] bg-[#fff1e4] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9b6b40]">Live API unavailable</p>
          <h3 className="mt-4 font-[var(--font-serif)] text-4xl leading-[1.04] text-[#4e3218]">
            The leaderboard surface is live, but the backend is not serving results right now.
          </h3>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#7c5330]">
            {error instanceof Error ? error.message : "Failed to load leaderboard data."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/" className="button-primary px-5 py-3 text-sm font-semibold">
              Back to Home
            </Link>
            <Link href="/tasks" className="button-secondary px-5 py-3 text-sm font-semibold">
              Browse Tasks Instead
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-[rgba(185,174,195,0.72)] bg-[rgba(255,255,255,0.6)] px-8 py-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">No runs yet</p>
          <h3 className="mt-4 font-[var(--font-serif)] text-4xl leading-[1.04] text-[var(--ink)]">
            This track is waiting for its first uploaded evaluation.
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Publish through the browser upload flow or the API/CLI helper to populate rankings, charts, and run pages.
          </p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <LeaderboardChart data={rows} />
          <div className="overflow-x-auto border-t border-[rgba(185,174,195,0.46)] pt-6">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr className="border-b border-[rgba(185,174,195,0.42)]">
                  <th className="py-3">Run</th>
                  <th className="py-3">Env</th>
                  <th className="py-3">Agent</th>
                  <th className="py-3">Success</th>
                  <th className="py-3">Return</th>
                  <th className="py-3">Cost (ms/step)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.run_id} className="border-b border-[rgba(185,174,195,0.34)] last:border-b-0">
                    <td className="py-4 font-mono text-xs">
                      <Link className="editorial-link font-[var(--font-mono)] text-[var(--ink)]" href={`/runs/${row.run_id}`}>
                        #{index + 1} {row.run_id}
                      </Link>
                    </td>
                    <td className="py-4">{row.env}</td>
                    <td className="py-4">{row.agent}</td>
                    <td className="py-4">{row.success_rate.toFixed(2)}</td>
                    <td className="py-4">{row.mean_return.toFixed(2)}</td>
                    <td className="py-4">{row.planning_cost_ms_per_step.toFixed(2)}</td>
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
