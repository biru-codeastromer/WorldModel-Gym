"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";

import { Button, cn } from "@/components/ui";
import type { Playback, PlaybackSpeed } from "./use-playback";

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4];

type TransportBarProps = {
  player: Playback;
  /** Disable transport entirely (e.g. single-step episode). */
  disabled?: boolean;
};

/**
 * Playback transport: restart, step-prev, play/pause, step-next, and a speed
 * selector. The play/pause button exposes aria-pressed so SR users hear its
 * toggled state. All controls are real buttons (keyboard-focusable); the parent
 * additionally wires arrow/space shortcuts when the player is focused.
 */
export function TransportBar({ player, disabled = false }: TransportBarProps) {
  const stepDisabled = disabled;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={player.restart}
        disabled={disabled || player.atStart}
        aria-label="Restart episode"
        className="px-2.5"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={player.prev}
        disabled={stepDisabled || player.atStart}
        aria-label="Previous step"
        className="px-2.5"
      >
        <SkipBack className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        variant="primary"
        size="sm"
        onClick={player.toggle}
        disabled={disabled}
        aria-pressed={player.playing}
        aria-label={player.playing ? "Pause playback" : "Play episode"}
        leftIcon={
          player.playing ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )
        }
      >
        {player.playing ? "Pause" : "Play"}
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={player.next}
        disabled={stepDisabled || player.atEnd}
        aria-label="Next step"
        className="px-2.5"
      >
        <SkipForward className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div
        className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1"
        role="group"
        aria-label="Playback speed"
      >
        {SPEEDS.map((s) => {
          const active = player.speed === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => player.setSpeed(s)}
              aria-pressed={active}
              disabled={disabled}
              className={cn(
                "rounded-full px-2.5 py-1 font-mono text-[0.7rem] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55",
                active ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
              )}
            >
              {s}×
            </button>
          );
        })}
      </div>
    </div>
  );
}
