import { cn } from "./cn";

type MetricBarProps = {
  /** Primary value in 0..1 (e.g. success rate). Clamped. */
  value: number;
  /** Optional confidence interval half-width in 0..1, drawn as a whisker. */
  ci?: number;
  tone?: "accent" | "success" | "warning" | "danger";
  /** Show the numeric percentage label to the right. Default true. */
  showLabel?: boolean;
  className?: string;
};

const TONE: Record<NonNullable<MetricBarProps["tone"]>, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger"
};

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Horizontal success-rate bar with an optional CI whisker. Used inline in
 * leaderboard rows. Has role="img" + aria-label so the value is announced.
 */
export function MetricBar({
  value,
  ci,
  tone = "accent",
  showLabel = true,
  className
}: MetricBarProps) {
  const v = clamp(value);
  const pct = Math.round(v * 100);
  const lo = ci !== undefined ? clamp(v - ci) : undefined;
  const hi = ci !== undefined ? clamp(v + ci) : undefined;
  const label =
    ci !== undefined
      ? `${pct}% (±${Math.round(ci * 100)}%)`
      : `${pct}%`;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="img"
        aria-label={`Success rate ${label}`}
        className="relative h-2 w-full min-w-[60px] overflow-visible rounded-full bg-surface-3"
      >
        <div
          className={cn("h-full rounded-full", TONE[tone])}
          style={{ width: `${pct}%` }}
        />
        {lo !== undefined && hi !== undefined && (
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full border-x-2 border-border-strong/70"
            style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      {showLabel ? (
        <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-fg-muted">
          {pct}%
        </span>
      ) : null}
    </div>
  );
}
