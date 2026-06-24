"use client";

import { useMemo } from "react";

import { cn } from "@/components/ui";
import type { TraceStep } from "@/lib/trace";
import { eventTone, stepReward } from "./step-utils";

type StepStripProps = {
  steps: TraceStep[];
  current: number;
  onSelect: (index: number) => void;
  /**
   * Max bars to render. Long episodes are down-sampled to this many *buckets*;
   * clicking a bucket seeks to the first step it represents. Default 64.
   */
  maxBars?: number;
};

type Bar = {
  /** Step index this bar maps to (first step of its bucket). */
  index: number;
  /** Normalized reward height in [0,1] (0.5 = no/zero reward baseline). */
  height: number;
  tone: "accent" | "success" | "danger" | "neutral";
};

/**
 * A compact, clickable reward strip across an episode. Each bar's height encodes
 * its step reward (relative to the episode's reward range) and its color flags
 * success/failure events. The current step's bar is highlighted. For very long
 * episodes the strip is down-sampled into <= maxBars buckets so it never blows
 * up the DOM, while clicks still seek to a real step. Decorative (aria-hidden);
 * the slider + live region own accessibility.
 */
export function StepStrip({ steps, current, onSelect, maxBars = 64 }: StepStripProps) {
  const { bars, bucketSize } = useMemo(() => {
    const n = steps.length;
    if (n === 0) return { bars: [] as Bar[], bucketSize: 1 };

    const rewards = steps.map((s) => stepReward(s));
    const finite = rewards.filter((r): r is number => r !== null);
    const min = finite.length ? Math.min(...finite, 0) : 0;
    const max = finite.length ? Math.max(...finite, 0) : 0;
    const range = max - min || 1;

    const size = Math.max(1, Math.ceil(n / maxBars));
    const out: Bar[] = [];
    for (let start = 0; start < n; start += size) {
      const end = Math.min(start + size, n);
      // Aggregate the bucket: peak-magnitude reward + strongest event tone.
      let peak = 0;
      let peakReward: number | null = null;
      let tone: Bar["tone"] = "accent";
      let sawSuccess = false;
      let sawDanger = false;
      for (let i = start; i < end; i++) {
        const r = rewards[i];
        if (r !== null && Math.abs(r) >= peak) {
          peak = Math.abs(r);
          peakReward = r;
        }
        for (const e of steps[i].events ?? []) {
          const t = eventTone(e);
          if (t === "success") sawSuccess = true;
          else if (t === "danger") sawDanger = true;
        }
      }
      if (sawSuccess) tone = "success";
      else if (sawDanger) tone = "danger";
      else if (peakReward !== null && peakReward < 0) tone = "danger";

      const height =
        peakReward === null ? 0.5 : 0.12 + ((peakReward - min) / range) * 0.88;
      out.push({ index: start, height: Math.min(1, Math.max(0.08, height)), tone });
    }
    return { bars: out, bucketSize: size };
  }, [steps, maxBars]);

  if (bars.length === 0) return null;

  const currentBucket = Math.floor(current / bucketSize);

  return (
    <div
      className="flex h-14 items-end gap-[2px] rounded-md border border-border bg-surface-2 px-2 py-2"
      aria-hidden="true"
    >
      {bars.map((bar, i) => {
        const active = i === currentBucket;
        return (
          <button
            key={bar.index}
            type="button"
            tabIndex={-1}
            onClick={() => onSelect(bar.index)}
            className={cn(
              "group relative flex h-full min-w-[3px] flex-1 items-end rounded-[2px] transition-colors",
              "hover:bg-surface-3"
            )}
          >
            <span
              className={cn(
                "w-full rounded-[2px] transition-all",
                active
                  ? "bg-accent"
                  : bar.tone === "success"
                    ? "bg-success/70"
                    : bar.tone === "danger"
                      ? "bg-danger/70"
                      : "bg-fg-subtle/45 group-hover:bg-fg-subtle/70"
              )}
              style={{ height: `${(bar.height * 100).toFixed(1)}%` }}
            />
            {active ? (
              <span className="pointer-events-none absolute inset-x-0 -top-1 mx-auto h-1 w-1 rounded-full bg-accent" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
