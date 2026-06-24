"use client";

import dynamic from "next/dynamic";

import { Card, Skeleton } from "@/components/ui";
import type { LeaderboardRow } from "@/lib/api";

/**
 * The recharts-backed chart is the single heaviest dependency on the
 * leaderboard route (~110 kB of recharts + d3). It is below the fold and never
 * needed for the initial paint, so we code-split it with next/dynamic
 * (ssr:false) — recharts also reads layout off the DOM, so client-only is the
 * correct boundary. A token-themed Skeleton holds the exact final height to
 * avoid any cumulative layout shift while the chunk streams in.
 */
const LeaderboardChartImpl = dynamic(
  () => import("./leaderboard-chart.impl").then((m) => m.LeaderboardChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />
  }
);

function ChartSkeleton() {
  return (
    <Card
      elevation="raised"
      padding="md"
      className="overflow-hidden"
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
      {/* Reserve the same 18rem (h-72) the live chart uses, so the chunk
          swapping in causes zero layout shift. */}
      <Skeleton className="h-72 w-full" />
    </Card>
  );
}

export function LeaderboardChart({ data }: { data: LeaderboardRow[] }) {
  return <LeaderboardChartImpl data={data} />;
}
