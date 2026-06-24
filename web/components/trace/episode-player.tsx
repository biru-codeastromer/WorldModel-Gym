"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Film } from "lucide-react";

import { Badge, Card, Segmented, cn } from "@/components/ui";
import { Sparkline } from "@/components/visuals";
import type { TraceEpisode } from "@/lib/trace";
import {
  cumulativeReturns,
  episodeLabel,
  episodeReturn,
  episodeSucceeded,
  stepReward
} from "./step-utils";
import { StepDetail } from "./step-detail";
import { StepStrip } from "./step-strip";
import { Timeline } from "./timeline";
import { TransportBar } from "./transport-bar";
import { usePlayback } from "./use-playback";

type EpisodePlayerProps = {
  episodes: TraceEpisode[];
  /** Cap on episodes offered in the selector (defensive against huge traces). */
  maxEpisodes?: number;
};

/**
 * Research-instrument episode player.
 *
 * Wires {@link usePlayback} to a transport bar, scrubbable {@link Timeline},
 * clickable reward {@link StepStrip}, and a {@link StepDetail} panel. Supports
 * multiple episodes via a selector. Keyboard: when the player region is focused
 * (or any non-form child within it), Left/Right step, Space toggles play. An
 * aria-live region politely announces the current step for screen readers.
 *
 * The player assumes `episodes` is already normalized + non-empty; the page
 * keeps its existing "no trace" / "trace unavailable" panels for those cases.
 */
export function EpisodePlayer({ episodes, maxEpisodes = 40 }: EpisodePlayerProps) {
  const offered = useMemo(() => episodes.slice(0, maxEpisodes), [episodes, maxEpisodes]);
  const [episodeIdx, setEpisodeIdx] = useState(0);

  // Clamp selected episode if the list shrinks.
  const safeEpisodeIdx = Math.min(episodeIdx, Math.max(0, offered.length - 1));
  const episode = offered[safeEpisodeIdx];
  const steps = useMemo(() => episode?.steps ?? [], [episode]);
  const length = steps.length;

  const player = usePlayback(length);
  const { index, seek, next, prev, toggle } = player;

  const cumReturns = useMemo(() => cumulativeReturns(steps), [steps]);
  const rewardSeries = useMemo(
    () => steps.map((s) => stepReward(s) ?? 0),
    [steps]
  );

  const currentStep = steps[index];
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts, active only while focus is within the player and not in
  // a text/range control (the slider owns its own arrow handling).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        toggle();
      }
    },
    [next, prev, toggle]
  );

  // Reset cursor when switching episodes.
  useEffect(() => {
    seek(0);
    // usePlayback also resets on length change; this covers same-length swaps.
  }, [safeEpisodeIdx, seek]);

  if (!episode) return null;

  const multi = offered.length > 1;
  const hiddenEpisodes = episodes.length - offered.length;
  const epReturn = episodeReturn(episode);
  const succeeded = episodeSucceeded(episode);

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="font-serif text-xl text-fg">Episode player</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {succeeded ? (
            <Badge tone="success" variant="soft">
              goal reached
            </Badge>
          ) : null}
          {epReturn !== null ? (
            <Badge tone="neutral" variant="outline">
              return {epReturn.toFixed(2)}
            </Badge>
          ) : null}
          <Badge tone="neutral" variant="outline">
            {length} {length === 1 ? "step" : "steps"}
          </Badge>
        </div>
      </div>

      {/* Episode selector (only when more than one episode). */}
      {multi ? (
        <div className="mt-5">
          <EpisodeSelector
            episodes={offered}
            value={safeEpisodeIdx}
            onChange={setEpisodeIdx}
          />
          {hiddenEpisodes > 0 ? (
            <p className="mt-2 font-mono text-[0.7rem] text-fg-subtle">
              + {hiddenEpisodes} more {hiddenEpisodes === 1 ? "episode" : "episodes"} not shown
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Player surface: focusable region with keyboard shortcuts. */}
      <div
        ref={containerRef}
        role="group"
        aria-label="Episode playback controls. Left and right arrows step; space toggles play."
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cn(
          "mt-5 rounded-lg border border-border bg-surface p-4",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        )}
      >
        <TransportBar player={player} disabled={length <= 1} />

        <div className="mt-4 flex items-center gap-3">
          <span className="shrink-0 font-mono text-xs tabular-nums text-fg-muted">
            {index + 1}/{length}
          </span>
          <Timeline
            length={length}
            value={index}
            onChange={seek}
            label="Episode step scrubber"
            disabled={length <= 1}
          />
        </div>

        <div className="mt-3">
          <StepStrip steps={steps} current={index} onSelect={seek} />
        </div>

        {/* Reward trend with current-position marker. */}
        {rewardSeries.length >= 2 ? (
          <div className="mt-4 flex items-center gap-3">
            <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-fg-subtle">
              reward
            </span>
            <Sparkline
              data={rewardSeries}
              tone={rewardSeries[rewardSeries.length - 1] >= rewardSeries[0] ? "success" : "danger"}
              width={200}
              height={32}
            />
          </div>
        ) : null}
      </div>

      {/* Current step detail. */}
      <div className="mt-5">
        <StepDetail
          step={currentStep}
          index={index}
          total={length}
          cumulativeReturn={cumReturns[index] ?? 0}
        />
      </div>

      {/* Polite live region announcing the current step. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`Step ${index + 1} of ${length}. Return ${(cumReturns[index] ?? 0).toFixed(2)}.`}
      </p>
    </Card>
  );
}

/**
 * Episode selector. Uses Segmented for a small number of episodes; falls back to
 * a native <select> once the count would overflow the tablist horizontally.
 */
function EpisodeSelector({
  episodes,
  value,
  onChange
}: {
  episodes: TraceEpisode[];
  value: number;
  onChange: (index: number) => void;
}) {
  if (episodes.length <= 6) {
    return (
      <Segmented<string>
        ariaLabel="Select episode"
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        size="sm"
        options={episodes.map((_, i) => ({ value: String(i), label: `Ep ${i + 1}` }))}
      />
    );
  }
  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-fg-subtle">
        Episode
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className={cn(
          "rounded-md border border-border-strong bg-surface px-3 py-1.5 font-mono text-sm text-fg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {episodes.map((ep, i) => (
          <option key={i} value={i}>
            {episodeLabel(ep, i)}
          </option>
        ))}
      </select>
    </label>
  );
}
