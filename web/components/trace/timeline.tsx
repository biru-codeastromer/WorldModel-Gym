"use client";

import { cn } from "@/components/ui";

type TimelineProps = {
  /** Number of steps (slider max is length-1). */
  length: number;
  /** Current step index. */
  value: number;
  onChange: (index: number) => void;
  /** Accessible label for the slider. */
  label: string;
  disabled?: boolean;
};

/**
 * Scrubbable timeline built on a native range input so it is fully keyboard- and
 * AT-accessible out of the box (Left/Right/Home/End, aria-valuenow/min/max). We
 * surface an explicit aria-label + aria-valuetext ("Step N of M") and color the
 * filled portion of the track via a CSS variable so it stays themed in both
 * light and dark. The thumb is the focusable control; focus-visible ring is
 * applied through the input's focus state.
 */
export function Timeline({ length, value, onChange, label, disabled = false }: TimelineProps) {
  const max = Math.max(0, length - 1);
  const pct = max === 0 ? 0 : (value / max) * 100;

  return (
    <div className="trace-timeline w-full">
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled || max === 0}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`Step ${value + 1} of ${length}`}
        className={cn(
          "trace-range h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3 outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
        style={{
          // Filled portion via a gradient so we don't need pseudo-element JS.
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--surface-3) ${pct}%, var(--surface-3) 100%)`
        }}
      />
      {/* Scoped thumb styling — inline <style> here is a STYLE block, allowed by
          CSP (only inline <script> needs the nonce). */}
      <style>{`
        .trace-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 1.05rem;
          width: 1.05rem;
          border-radius: 9999px;
          background: var(--accent);
          border: 2px solid var(--surface);
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
          cursor: pointer;
        }
        .trace-range::-moz-range-thumb {
          height: 1.05rem;
          width: 1.05rem;
          border-radius: 9999px;
          background: var(--accent);
          border: 2px solid var(--surface);
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
          cursor: pointer;
        }
        .trace-range:disabled::-webkit-slider-thumb { background: var(--fg-subtle); }
        .trace-range:disabled::-moz-range-thumb { background: var(--fg-subtle); }
      `}</style>
    </div>
  );
}
