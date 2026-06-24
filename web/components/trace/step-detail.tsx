"use client";

import { Flag, Target } from "lucide-react";

import { Badge, cn } from "@/components/ui";
import { formatMetric } from "@/lib/api";
import type { TraceStep } from "@/lib/trace";
import { eventTone, stepAction, stepReward, stepTerminal } from "./step-utils";

type StepDetailProps = {
  step: TraceStep | undefined;
  /** 0-based index of this step within the episode. */
  index: number;
  /** Total steps in the episode. */
  total: number;
  /** Cumulative return up to and including this step. */
  cumulativeReturn: number;
};

/**
 * Detail panel for the currently-selected step: index, action, instantaneous
 * reward, cumulative return, termination flags, and semantic events rendered as
 * tone-coded Badge chips (success/goal events highlighted distinctly). All
 * values are read defensively, so a malformed step renders as "--" rather than
 * throwing.
 */
export function StepDetail({ step, index, total, cumulativeReturn }: StepDetailProps) {
  const reward = stepReward(step);
  const action = stepAction(step);
  const term = stepTerminal(step);
  const events = step?.events ?? [];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Step" value={`${index + 1} / ${total}`} mono />
        <Field label="Action" value={action ?? "--"} mono />
        <Field
          label="Reward"
          value={reward !== null ? formatMetric(reward, 3) : "--"}
          tone={reward !== null ? (reward > 0 ? "success" : reward < 0 ? "danger" : undefined) : undefined}
          mono
        />
        <Field label="Return" value={formatMetric(cumulativeReturn, 3)} mono />
      </div>

      {/* Termination flags */}
      {(term.done || term.terminated || term.truncated) && (
        <div className="flex flex-wrap items-center gap-2">
          {term.terminated && (
            <Badge tone="success" variant="soft">
              <Flag className="h-3 w-3" aria-hidden="true" />
              terminated
            </Badge>
          )}
          {term.truncated && (
            <Badge tone="warning" variant="soft">
              truncated
            </Badge>
          )}
          {term.done && !term.terminated && !term.truncated && (
            <Badge tone="neutral" variant="outline">
              done
            </Badge>
          )}
        </div>
      )}

      {/* Events at this step */}
      <div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle">
          Events
        </p>
        {events.length === 0 ? (
          <p className="mt-2 font-mono text-sm text-fg-muted">No events at this step.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {events.map((evt, i) => {
              const tone = eventTone(evt);
              const isGoal = tone === "success";
              return (
                <li key={`${evt}-${i}`}>
                  <Badge
                    tone={tone === "neutral" ? "accent" : tone}
                    variant={isGoal ? "soft" : "outline"}
                  >
                    {isGoal ? <Target className="h-3 w-3" aria-hidden="true" /> : null}
                    {evt}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  tone,
  mono
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-sm text-fg",
          mono && "font-mono tabular-nums",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger"
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
