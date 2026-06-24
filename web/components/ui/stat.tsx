import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "./cn";

type StatProps = {
  /** Mono uppercase label above the value. */
  label: string;
  /** The primary value (serif display). Accepts node for count-up wrappers. */
  value: React.ReactNode;
  /** Small unit/suffix shown after the value (e.g. "%"). */
  unit?: string;
  /** Optional delta; sign drives color + arrow. */
  delta?: number;
  /** Format the delta (e.g. (d) => `${d.toFixed(1)}%`). */
  formatDelta?: (delta: number) => string;
  /** Confidence interval shown as "±x" under the value. */
  ci?: number;
  className?: string;
};

export function Stat({
  label,
  value,
  unit,
  delta,
  formatDelta,
  ci,
  className
}: StatProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="font-serif text-3xl leading-none text-fg">{value}</span>
        {unit ? (
          <span className="font-mono text-sm text-fg-muted">{unit}</span>
        ) : null}
      </span>
      {(delta !== undefined || ci !== undefined) && (
        <span className="flex items-center gap-2 font-mono text-xs">
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5",
                positive ? "text-success" : "text-danger"
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {formatDelta ? formatDelta(delta) : delta}
            </span>
          )}
          {ci !== undefined && (
            <span className="text-fg-subtle">±{ci}</span>
          )}
        </span>
      )}
    </div>
  );
}
