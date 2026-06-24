"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchTrace, toFiniteNumber } from "@/lib/api";
import { extractEvents, normalizeEpisodes } from "@/lib/trace";
import { Sparkline } from "@/components/visuals";
import { Skeleton } from "@/components/ui";

/**
 * Optional, graceful per-run trace summary for the comparison view.
 *
 * A trace is a SOFT dependency: if it is missing, errors, or is empty we render
 * a quiet placeholder rather than failing the column. The query is kept cheap by
 * reusing the same ["trace", runId] cache key the run viewer uses, so navigating
 * between the two surfaces does not refetch.
 */
export function TraceSummary({ runId }: { runId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["trace", runId],
    queryFn: () => fetchTrace(runId),
    // Trace is decorative here — don't hammer the API if it 404s.
    retry: false,
    staleTime: 60_000
  });

  const { rewards, episodes, steps, events } = useMemo(() => {
    try {
      const raw = Array.isArray(data) ? data : [];
      const eps = normalizeEpisodes(raw);
      const evts = extractEvents(eps);
      const totalSteps = eps.reduce((sum, ep) => sum + (ep.steps?.length ?? 0), 0);
      // Flatten per-step rewards across episodes for a single trend line.
      const r: number[] = [];
      for (const ep of eps) {
        for (const step of ep.steps ?? []) {
          const reward = toFiniteNumber((step as Record<string, unknown>).reward);
          if (reward !== null) r.push(reward);
        }
      }
      return { rewards: r, episodes: eps.length, steps: totalSteps, events: evts.length };
    } catch {
      return { rewards: [] as number[], episodes: 0, steps: 0, events: 0 };
    }
  }, [data]);

  if (isLoading) {
    return <Skeleton className="h-7 w-full rounded-md" />;
  }

  if (isError || steps === 0) {
    return (
      <p className="font-mono text-[0.7rem] leading-5 text-fg-subtle">No trace recorded</p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {rewards.length >= 2 ? (
        <Sparkline
          data={rewards}
          tone={rewards[rewards.length - 1] >= rewards[0] ? "success" : "danger"}
          width={96}
          height={26}
          className="shrink-0"
        />
      ) : (
        <span className="h-[26px] w-[96px] shrink-0" aria-hidden="true" />
      )}
      <span className="font-mono text-[0.7rem] leading-5 text-fg-subtle">
        {episodes} {episodes === 1 ? "ep" : "eps"} · {steps} steps · {events} events
      </span>
    </div>
  );
}
