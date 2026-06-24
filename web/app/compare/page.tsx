"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { ArrowLeft, GitCompareArrows, Trophy } from "lucide-react";

import { Reveal } from "@/components/motion";
import { GridWorld } from "@/components/visuals";
import { TraceSummary } from "@/components/compare/trace-summary";
import {
  Badge,
  Button,
  Card,
  MetricBar,
  Section,
  SectionHeader,
  Skeleton,
  cn
} from "@/components/ui";
import { fetchRun, formatMetric, type RunResponse } from "@/lib/api";
import {
  bestIndex,
  MAX_COMPARE,
  parseRunIds,
  summarizeRun,
  type RunMetricSummary
} from "@/lib/compare";

export default function ComparePage() {
  // useSearchParams must be inside a Suspense boundary for static rendering.
  return (
    <Suspense fallback={<CompareFallback />}>
      <CompareView />
    </Suspense>
  );
}

function CompareView() {
  const searchParams = useSearchParams();
  const ids = useMemo(() => parseRunIds(searchParams.get("runs")), [searchParams]);

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["run", id],
      queryFn: () => fetchRun(id),
      enabled: ids.length > 0
    }))
  });

  // 0 / 1 selected → empty state with a CTA back to the leaderboard.
  if (ids.length < 2) {
    return <EmptyState count={ids.length} />;
  }

  return (
    <div className="pb-10">
      {/* ---- Header ---- */}
      <Section className="border-b border-border pt-2 md:pt-4">
        <Reveal>
          <BackLink />
        </Reveal>
        <Reveal className="mt-5">
          <SectionHeader
            as="h1"
            kicker="Run comparison"
            title={`Comparing ${ids.length} runs, metric by metric.`}
            lede="Aligned scores across selected runs — success rate with confidence, mean return, planning cost, and world-model fidelity. The best value in each row is highlighted."
            action={
              <Link href="/leaderboard">
                <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
                  Leaderboard
                </Button>
              </Link>
            }
          />
        </Reveal>
      </Section>

      <Section className="!pt-8">
        <ComparisonGrid ids={ids} queries={queries} />
      </Section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Comparison grid                                                            */
/* -------------------------------------------------------------------------- */

type RunQuery = {
  data?: RunResponse;
  isLoading: boolean;
  isError: boolean;
};

function ComparisonGrid({
  ids,
  queries
}: {
  ids: string[];
  queries: RunQuery[];
}) {
  const summaries = useMemo<RunMetricSummary[]>(
    () => queries.map((q) => summarizeRun(q.data)),
    [queries]
  );

  // Best-value indices per metric row.
  const best = useMemo(
    () => ({
      successRate: bestIndex(summaries.map((s) => s.successRate), "higher"),
      meanReturn: bestIndex(summaries.map((s) => s.meanReturn), "higher"),
      planningCost: bestIndex(summaries.map((s) => s.planningCost), "lower"),
      fidelityK1: bestIndex(summaries.map((s) => s.fidelityK1), "higher"),
      fidelityK5: bestIndex(summaries.map((s) => s.fidelityK5), "higher"),
      fidelityK10: bestIndex(summaries.map((s) => s.fidelityK10), "higher")
    }),
    [summaries]
  );

  const cols = ids.length;
  // Equal-width columns; the whole grid scrolls horizontally on narrow screens.
  const gridStyle = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };

  return (
    <Reveal>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[640px] space-y-3">
          {/* ---- Column headers ---- */}
          <div className="grid gap-3" style={gridStyle}>
            {ids.map((id, i) => (
              <RunHeaderCard key={id} runId={id} query={queries[i]} />
            ))}
          </div>

          {/* ---- Metric rows ---- */}
          <MetricRow
            label="Success rate"
            cols={cols}
            best={best.successRate}
            render={(i) => {
              const s = summaries[i];
              if (s.successRate === null) return <Empty />;
              const tone =
                s.successRate >= 0.66 ? "success" : s.successRate >= 0.33 ? "warning" : "accent";
              return (
                <div className="space-y-1.5">
                  <MetricBar value={s.successRate} ci={s.successCi ?? undefined} tone={tone} />
                  {s.successCi !== null ? (
                    <span className="font-mono text-[0.7rem] text-fg-subtle">
                      ±{(s.successCi * 100).toFixed(1)}% CI
                    </span>
                  ) : null}
                </div>
              );
            }}
          />

          <MetricRow
            label="Mean return"
            cols={cols}
            best={best.meanReturn}
            render={(i) => {
              const s = summaries[i];
              return (
                <ValueCell
                  value={formatMetric(s.meanReturn, 2)}
                  sub={s.meanReturnCi !== null ? `±${s.meanReturnCi.toFixed(2)} CI` : undefined}
                />
              );
            }}
          />

          <MetricRow
            label="Planning cost"
            unit="ms/step"
            cols={cols}
            best={best.planningCost}
            render={(i) => (
              <ValueCell value={formatMetric(summaries[i].planningCost, 2)} sub="lower is better" />
            )}
          />

          <MetricRow
            label="Fidelity k1"
            cols={cols}
            best={best.fidelityK1}
            render={(i) => <ValueCell value={formatMetric(summaries[i].fidelityK1, 3)} />}
          />
          <MetricRow
            label="Fidelity k5"
            cols={cols}
            best={best.fidelityK5}
            render={(i) => <ValueCell value={formatMetric(summaries[i].fidelityK5, 3)} />}
          />
          <MetricRow
            label="Fidelity k10"
            cols={cols}
            best={best.fidelityK10}
            render={(i) => <ValueCell value={formatMetric(summaries[i].fidelityK10, 3)} />}
          />

          {/* ---- Trace summary (optional / graceful) ---- */}
          <MetricRow
            label="Trace"
            cols={cols}
            best={-1}
            render={(i) => {
              const q = queries[i];
              if (q.isLoading) return <Skeleton className="h-7 w-full rounded-md" />;
              if (q.isError || !q.data) return <Empty />;
              return <TraceSummary runId={ids[i]} />;
            }}
          />
        </div>
      </div>
    </Reveal>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-run column header                                                      */
/* -------------------------------------------------------------------------- */

function RunHeaderCard({ runId, query }: { runId: string; query: RunQuery }) {
  if (query.isLoading) {
    return (
      <Card padding="md" className="h-full">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-5 w-32" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </Card>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card padding="md" inset className="h-full border-warning/40">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle">Run</p>
        <p className="mt-2 break-all font-mono text-xs text-fg">{runId}</p>
        <Badge tone="warning" variant="soft" className="mt-3">
          Unavailable
        </Badge>
        <p className="mt-2 font-mono text-[0.7rem] leading-5 text-fg-muted">
          This run could not be loaded.
        </p>
        <Link
          href={`/runs/${runId}`}
          className="mt-3 inline-flex rounded-sm font-mono text-[0.7rem] text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open run page
        </Link>
      </Card>
    );
  }

  const run = query.data;
  return (
    <Card padding="md" className="h-full">
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle">Run</p>
      <Link
        href={`/runs/${runId}`}
        className="mt-1.5 block break-all rounded-sm font-mono text-sm text-fg transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {runId}
      </Link>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="accent" variant="soft">
          {run.agent || "agent ?"}
        </Badge>
        <Badge tone="neutral" variant="outline">
          env {run.env || "?"}
        </Badge>
        <Badge tone="neutral" variant="outline">
          {run.track || "track ?"}
        </Badge>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Metric row + cells                                                         */
/* -------------------------------------------------------------------------- */

function MetricRow({
  label,
  unit,
  cols,
  best,
  render
}: {
  label: string;
  unit?: string;
  cols: number;
  /** Index of the winning column, or -1 for no highlight. */
  best: number;
  render: (col: number) => React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-2">
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle">
          {label}
          {unit ? (
            <span className="ml-1.5 normal-case tracking-normal text-fg-subtle">({unit})</span>
          ) : null}
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }, (_, i) => (
          <div
            key={i}
            className={cn(
              "min-w-0 px-4 py-3.5",
              i > 0 ? "border-l border-border" : "",
              i === best ? "bg-accent-soft/60" : ""
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">{render(i)}</div>
              {i === best ? (
                <Badge tone="accent" variant="soft" className="shrink-0">
                  <Trophy className="h-3 w-3" aria-hidden="true" />
                  Best
                </Badge>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueCell({ value, sub }: { value: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-base tabular-nums text-fg">{value}</p>
      {sub ? <p className="font-mono text-[0.7rem] text-fg-subtle">{sub}</p> : null}
    </div>
  );
}

function Empty() {
  return <span className="font-mono text-sm text-fg-subtle">--</span>;
}

/* -------------------------------------------------------------------------- */
/* Empty / fallback states                                                    */
/* -------------------------------------------------------------------------- */

function BackLink() {
  return (
    <Link
      href="/leaderboard"
      className="inline-flex items-center gap-1.5 rounded-sm font-mono text-xs uppercase tracking-[0.14em] text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      Leaderboard
    </Link>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <Section>
      <Reveal>
        <Card elevation="flat" padding="lg" inset className="mx-auto max-w-xl border-dashed text-center">
          <div className="mx-auto flex max-w-md flex-col items-center">
            <div className="relative mb-6 h-28 w-28">
              <GridWorld className="h-full w-full opacity-90" />
              <span className="absolute -right-2 -top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                <GitCompareArrows className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-fg-subtle">
              Nothing to compare
            </p>
            <h1 className="mt-3 font-serif text-2xl leading-snug text-fg md:text-3xl">
              {count === 1
                ? "Pick at least one more run to compare."
                : "Select runs to compare them side by side."}
            </h1>
            <p className="mt-3 font-mono text-sm leading-7 text-fg-muted">
              Head to the leaderboard, tick the runs you want (up to {MAX_COMPARE}), then use the
              &ldquo;Compare&rdquo; bar to line them up here.
            </p>
            <div className="mt-6">
              <Link href="/leaderboard">
                <Button variant="primary" size="md">
                  Go to leaderboard
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </Reveal>
    </Section>
  );
}

function CompareFallback() {
  return (
    <Section>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-5 h-9 w-80 max-w-full" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} padding="md">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-5 w-28" />
            <Skeleton className="mt-4 h-6 w-24 rounded-full" />
          </Card>
        ))}
      </div>
    </Section>
  );
}
