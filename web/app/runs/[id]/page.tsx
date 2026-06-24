"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Upload, Waypoints } from "lucide-react";

import { fetchRun, fetchTrace, formatMetric, toFiniteNumber } from "@/lib/api";
import { extractEvents, normalizeEpisodes } from "@/lib/trace";
import type { TraceEpisode } from "@/lib/trace";
import { Reveal, useHoverLift } from "@/components/motion";
import { Sparkline } from "@/components/visuals";
import { EpisodePlayer } from "@/components/trace";
import {
  Badge,
  Button,
  Card,
  CountUp,
  MetricBar,
  Segmented,
  Skeleton,
  Stat
} from "@/components/ui";

type TabKey = "metrics" | "trace" | "config";

const TAB_OPTIONS: { value: TabKey; label: string }[] = [
  { value: "metrics", label: "Metrics" },
  { value: "trace", label: "Trace" },
  { value: "config", label: "Config" }
];

// Hard cap on how many episodes/events we attempt to render so a huge trace
// cannot lock up the main thread. Anything beyond is summarised. (Per-step
// virtualization lives inside the player's StepStrip.)
const MAX_EPISODES = 40;
const MAX_EVENTS = 80;

/** Pull a finite half-width CI from a [low, high] tuple (or array). */
function ciHalfWidth(ci: unknown): number | null {
  if (!Array.isArray(ci) || ci.length < 2) return null;
  const lo = toFiniteNumber(ci[0]);
  const hi = toFiniteNumber(ci[1]);
  if (lo === null || hi === null) return null;
  return Math.abs(hi - lo) / 2;
}

/** planning_cost may be a scalar or an object with wall_clock_ms_per_step. */
function planningCostMs(planning: unknown): number | null {
  const scalar = toFiniteNumber(planning);
  if (scalar !== null) return scalar;
  if (planning && typeof planning === "object") {
    return toFiniteNumber((planning as Record<string, unknown>).wall_clock_ms_per_step);
  }
  return null;
}

export default function RunViewerPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const [tab, setTab] = useState<TabKey>("metrics");

  const runQuery = useQuery({ queryKey: ["run", runId], queryFn: () => fetchRun(runId) });
  const traceQuery = useQuery({ queryKey: ["trace", runId], queryFn: () => fetchTrace(runId) });

  // normalizeEpisodes/extractEvents already tolerate malformed records, but wrap
  // them here too so a totally unexpected payload shape cannot throw during
  // render and white-screen the page.
  const episodes = useMemo<TraceEpisode[]>(() => {
    try {
      const raw = traceQuery.data;
      return normalizeEpisodes(Array.isArray(raw) ? raw : []);
    } catch {
      return [];
    }
  }, [traceQuery.data]);

  const events = useMemo(() => {
    try {
      return extractEvents(episodes);
    } catch {
      return [];
    }
  }, [episodes]);

  const firstPlanner = useMemo(() => {
    for (const ep of episodes) {
      for (const step of ep.steps ?? []) {
        if (step.planner && Object.keys(step.planner).length > 0) {
          return step.planner;
        }
      }
    }
    return null;
  }, [episodes]);

  const totalSteps = useMemo(
    () => episodes.reduce((sum, ep) => sum + (ep.steps?.length ?? 0), 0),
    [episodes]
  );

  // ---- Loading -----------------------------------------------------------
  if (runQuery.isLoading) {
    return <RunViewerSkeleton />;
  }

  // ---- Hard error (run metadata itself failed) ---------------------------
  if (runQuery.isError || !runQuery.data) {
    return (
      <section className="pb-16">
        <BackLink />
        <Reveal className="mt-6">
          <Card elevation="raised" padding="lg" className="mx-auto max-w-xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
              <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
            </div>
            <h1 className="mt-5 font-serif text-2xl text-fg">Unable to load run</h1>
            <p className="mt-3 font-mono text-sm leading-7 text-fg-muted">
              We could not fetch run{" "}
              <span className="text-fg">{runId}</span>. It may not exist yet, or the API is
              unreachable.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button variant="secondary" onClick={() => runQuery.refetch()} loading={runQuery.isFetching}>
                Retry
              </Button>
              <Link href="/leaderboard">
                <Button variant="primary">Back to Leaderboard</Button>
              </Link>
            </div>
          </Card>
        </Reveal>
      </section>
    );
  }

  const run = runQuery.data;
  const metrics = run.metrics ?? {};

  const successRate = toFiniteNumber(metrics.success_rate);
  const successCi = ciHalfWidth(metrics.success_rate_ci);
  const meanReturn = toFiniteNumber(metrics.mean_return);
  const meanReturnCi = ciHalfWidth(metrics.mean_return_ci);
  const planCost = planningCostMs(metrics.planning_cost);
  const fidelity = metrics.model_fidelity ?? undefined;

  return (
    <section className="pb-16">
      {/* ---- Compact header ------------------------------------------------ */}
      <Reveal>
        <BackLink />
      </Reveal>

      <Reveal direction="up" delay={0.05} className="mt-5">
        <div className="flex flex-col gap-5 border-b border-border pb-7 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-accent">
              Run viewer
            </p>
            <h1 className="mt-2 break-all font-serif text-3xl leading-[1.08] tracking-[-0.01em] text-fg md:text-4xl">
              {runId}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone="accent" variant="soft">
                {run.agent || "agent ?"}
              </Badge>
              <Badge tone="neutral" variant="outline">
                env {run.env || "?"}
              </Badge>
              <Badge tone="neutral" variant="outline">
                {run.track || "track ?"}
              </Badge>
              <StatusBadge status={run.status} />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/leaderboard">
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
                Leaderboard
              </Button>
            </Link>
            <Link href="/upload">
              <Button variant="primary" size="sm" leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}>
                Upload Another Run
              </Button>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* ---- Headline metric strip (always visible) ------------------------ */}
      <Reveal group className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Success Rate"
          value={successRate}
          render={(v) => (
            <>
              <CountUp value={v * 100} decimals={1} suffix="%" />
              {successCi !== null ? (
                <span className="ml-1 font-mono text-sm text-fg-subtle">
                  ±{(successCi * 100).toFixed(1)}
                </span>
              ) : null}
            </>
          )}
          footer={
            successRate !== null ? (
              <MetricBar
                value={successRate}
                ci={successCi ?? undefined}
                tone="success"
                showLabel={false}
              />
            ) : null
          }
        />
        <MetricCard
          label="Mean Return"
          value={meanReturn}
          render={(v) => (
            <>
              <CountUp value={v} decimals={2} />
              {meanReturnCi !== null ? (
                <span className="ml-1 font-mono text-sm text-fg-subtle">
                  ±{meanReturnCi.toFixed(2)}
                </span>
              ) : null}
            </>
          )}
        />
        <MetricCard
          label="Planning Cost"
          value={planCost}
          unit="ms/step"
          render={(v) => <CountUp value={v} decimals={v < 10 ? 2 : 0} />}
        />
        <MetricCard
          label="Model Fidelity"
          value={toFiniteNumber(fidelity?.k1)}
          render={(v) => <CountUp value={v} decimals={3} />}
          footer={
            fidelity ? (
              <div className="flex items-center gap-3 font-mono text-[0.7rem] text-fg-subtle">
                <FidelityTick label="k1" value={fidelity.k1} />
                <FidelityTick label="k5" value={fidelity.k5} />
                <FidelityTick label="k20" value={fidelity.k20} />
              </div>
            ) : null
          }
        />
      </Reveal>

      {/* ---- Tabs ---------------------------------------------------------- */}
      <Reveal className="mt-9">
        <Segmented<TabKey>
          options={TAB_OPTIONS}
          value={tab}
          onChange={setTab}
          ariaLabel="Run detail sections"
        />
      </Reveal>

      <div className="mt-6" role="tabpanel" aria-label={TAB_OPTIONS.find((t) => t.value === tab)?.label}>
        {tab === "metrics" && (
          <MetricsPanel
            metrics={metrics}
            successRate={successRate}
            successCi={successCi}
            meanReturn={meanReturn}
            meanReturnCi={meanReturnCi}
          />
        )}
        {tab === "trace" && (
          <TracePanel
            isLoading={traceQuery.isLoading}
            isError={traceQuery.isError}
            episodes={episodes}
            events={events}
            totalSteps={totalSteps}
            firstPlanner={firstPlanner}
            onRetry={() => traceQuery.refetch()}
            retrying={traceQuery.isFetching}
          />
        )}
        {tab === "config" && (
          <ConfigPanel run={run} metrics={metrics} />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Header bits
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/leaderboard"
      className="inline-flex items-center gap-1.5 rounded-sm font-mono text-xs uppercase tracking-[0.14em] text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      All runs
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const tone = s.includes("complete") || s.includes("done") || s.includes("success")
    ? "success"
    : s.includes("fail") || s.includes("error")
      ? "danger"
      : s.includes("run") || s.includes("pending")
        ? "warning"
        : "neutral";
  if (!status) return null;
  return (
    <Badge tone={tone} variant="soft">
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Headline metric card (null-safe, with hover lift)
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  unit,
  render,
  footer
}: {
  label: string;
  value: number | null;
  unit?: string;
  render: (value: number) => React.ReactNode;
  footer?: React.ReactNode;
}) {
  const lift = useHoverLift(2);
  const available = value !== null;
  return (
    <Reveal>
      <motion.div {...lift}>
        <Card padding="md" className="h-full">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-fg-subtle">
            {label}
          </p>
          <p className="mt-3 flex items-baseline font-serif text-3xl leading-none text-fg md:text-[2rem]">
            {available ? (
              <>
                {render(value as number)}
                {unit ? <span className="ml-1.5 font-mono text-xs text-fg-muted">{unit}</span> : null}
              </>
            ) : (
              <span className="text-fg-subtle">--</span>
            )}
          </p>
          {footer ? <div className="mt-4">{footer}</div> : null}
        </Card>
      </motion.div>
    </Reveal>
  );
}

function FidelityTick({ label, value }: { label: string; value: unknown }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="uppercase tracking-[0.1em]">{label}</span>
      <span className="text-fg">{formatMetric(value, 2)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metrics panel
// ---------------------------------------------------------------------------

function MetricsPanel({
  metrics,
  successRate,
  successCi,
  meanReturn,
  meanReturnCi
}: {
  metrics: Record<string, unknown>;
  successRate: number | null;
  successCi: number | null;
  meanReturn: number | null;
  meanReturnCi: number | null;
}) {
  // Per-seed mean_return values (if present) → a small sparkline of variance.
  const perSeed = Array.isArray(metrics.per_seed)
    ? (metrics.per_seed as Record<string, unknown>[])
    : [];
  const seedReturns = perSeed
    .map((s) => toFiniteNumber(s.mean_return ?? s.return))
    .filter((n): n is number => n !== null);

  return (
    <Reveal group className="grid gap-4 lg:grid-cols-3">
      <Reveal className="lg:col-span-2">
        <Card padding="lg" className="h-full">
          <h2 className="font-serif text-xl text-fg">Headline metrics</h2>
          <p className="mt-1 font-mono text-xs text-fg-muted">
            Aggregate scores for this run, with confidence intervals where reported.
          </p>
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-surface-2 p-4">
              <Stat
                label="Success Rate"
                value={successRate !== null ? `${(successRate * 100).toFixed(1)}%` : "--"}
                ci={successCi !== null ? Number((successCi * 100).toFixed(1)) : undefined}
              />
              {successRate !== null ? (
                <MetricBar
                  value={successRate}
                  ci={successCi ?? undefined}
                  tone="success"
                  className="mt-4"
                />
              ) : null}
            </div>
            <div className="rounded-md border border-border bg-surface-2 p-4">
              <Stat
                label="Mean Return"
                value={meanReturn !== null ? meanReturn.toFixed(2) : "--"}
                ci={meanReturnCi !== null ? Number(meanReturnCi.toFixed(2)) : undefined}
              />
              {seedReturns.length >= 2 ? (
                <div className="mt-4 flex items-center gap-2">
                  <Sparkline data={seedReturns} tone="accent" width={120} height={28} />
                  <span className="font-mono text-[0.7rem] text-fg-subtle">
                    {seedReturns.length} seeds
                  </span>
                </div>
              ) : null}
            </div>
          </dl>
        </Card>
      </Reveal>

      <Reveal>
        <Card padding="lg" className="h-full">
          <h2 className="font-serif text-xl text-fg">Model fidelity</h2>
          <p className="mt-1 font-mono text-xs text-fg-muted">
            Rollout-horizon accuracy of the learned world model.
          </p>
          <div className="mt-6 space-y-4">
            {(["k1", "k5", "k20"] as const).map((k) => {
              const fid = metrics.model_fidelity as Record<string, unknown> | undefined;
              const v = toFiniteNumber(fid?.[k]);
              return (
                <div key={k}>
                  <div className="flex items-baseline justify-between font-mono text-xs">
                    <span className="uppercase tracking-[0.12em] text-fg-muted">{k} horizon</span>
                    <span className="text-fg">{formatMetric(v, 3)}</span>
                  </div>
                  {v !== null ? (
                    <MetricBar value={v} tone="accent" showLabel={false} className="mt-2" />
                  ) : (
                    <div className="mt-2 h-2 rounded-full bg-surface-3" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </Reveal>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// Trace panel
// ---------------------------------------------------------------------------

function TracePanel({
  isLoading,
  isError,
  episodes,
  events,
  totalSteps,
  firstPlanner,
  onRetry,
  retrying
}: {
  isLoading: boolean;
  isError: boolean;
  episodes: TraceEpisode[];
  events: { t: number; name: string }[];
  totalSteps: number;
  firstPlanner: Record<string, unknown> | null;
  onRetry: () => void;
  retrying: boolean;
}) {
  if (isLoading) {
    return (
      <Card padding="lg">
        <Skeleton className="h-5 w-48" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  // Trace unavailable is a SOFT failure — the run still renders, just without
  // a trace. Localised here so a missing/large trace never blocks metrics.
  if (isError) {
    return (
      <Card padding="lg" inset className="text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-warning-soft">
          <Waypoints className="h-5 w-5 text-warning" aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-serif text-xl text-fg">Trace unavailable</h2>
        <p className="mx-auto mt-2 max-w-sm font-mono text-sm leading-7 text-fg-muted">
          This run has no trace artifact, or it could not be fetched. Metrics and config are still
          available above.
        </p>
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} loading={retrying}>
          Retry trace
        </Button>
      </Card>
    );
  }

  if (episodes.length === 0 || totalSteps === 0) {
    return (
      <Card padding="lg" inset className="text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface-3">
          <Waypoints className="h-5 w-5 text-fg-subtle" aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-serif text-xl text-fg">No trace recorded</h2>
        <p className="mx-auto mt-2 max-w-sm font-mono text-sm leading-7 text-fg-muted">
          This run did not log a step-level trace. Upload a trace artifact to visualise the
          episode timeline.
        </p>
      </Card>
    );
  }

  return (
    <Reveal group className="space-y-4">
      {/* Summary chips */}
      <Reveal>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral" variant="outline">
            {episodes.length} {episodes.length === 1 ? "episode" : "episodes"}
          </Badge>
          <Badge tone="neutral" variant="outline">
            {totalSteps} steps
          </Badge>
          <Badge tone="neutral" variant="outline">
            {events.length} events
          </Badge>
          {firstPlanner ? <Badge tone="accent" variant="soft">planner trace</Badge> : null}
        </div>
      </Reveal>

      {/* Interactive episode player (replaces the static timeline). */}
      <Reveal>
        <EpisodePlayer episodes={episodes} maxEpisodes={MAX_EPISODES} />
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Events */}
        <Reveal>
          <Card padding="lg" className="h-full">
            <h2 className="font-serif text-xl text-fg">Events</h2>
            {events.length === 0 ? (
              <p className="mt-3 font-mono text-sm text-fg-muted">No semantic events recorded.</p>
            ) : (
              <>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {events.slice(0, MAX_EVENTS).map((evt, idx) => (
                    <li key={idx}>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[0.7rem] text-fg">
                        <span className="text-fg-subtle">t={evt.t}</span>
                        <span>{evt.name}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {events.length > MAX_EVENTS ? (
                  <p className="mt-3 font-mono text-xs text-fg-subtle">
                    + {events.length - MAX_EVENTS} more events
                  </p>
                ) : null}
              </>
            )}
          </Card>
        </Reveal>

        {/* Planner */}
        <Reveal>
          <Card padding="lg" className="h-full">
            <div className="flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-accent" aria-hidden="true" />
              <h2 className="font-serif text-xl text-fg">Planner</h2>
            </div>
            {firstPlanner ? (
              <pre className="mt-4 max-h-72 overflow-auto rounded-md border border-border bg-surface-2 p-4 font-mono text-xs leading-6 text-fg">
                {safeStringify(firstPlanner)}
              </pre>
            ) : (
              <p className="mt-3 font-mono text-sm text-fg-muted">
                No planner trace recorded for this run.
              </p>
            )}
          </Card>
        </Reveal>
      </div>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// Config panel
// ---------------------------------------------------------------------------

function ConfigPanel({
  run,
  metrics
}: {
  run: { id: string; env: string; agent: string; track: string; status: string; created_at: string; updated_at: string; trace_url?: string | null; config_url?: string | null };
  metrics: Record<string, unknown>;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Run ID", value: run.id },
    { label: "Agent", value: run.agent || "--" },
    { label: "Environment", value: run.env || "--" },
    { label: "Track", value: run.track || "--" },
    { label: "Status", value: run.status || "--" },
    { label: "Created", value: formatDate(run.created_at) },
    { label: "Updated", value: formatDate(run.updated_at) }
  ];

  return (
    <Reveal group className="grid gap-4 lg:grid-cols-2">
      <Reveal>
        <Card padding="lg" className="h-full">
          <h2 className="font-serif text-xl text-fg">Run configuration</h2>
          <dl className="mt-5 divide-y divide-border">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 py-2.5">
                <dt className="font-mono text-xs uppercase tracking-[0.12em] text-fg-subtle">
                  {r.label}
                </dt>
                <dd className="break-all text-right font-mono text-sm text-fg">{r.value}</dd>
              </div>
            ))}
          </dl>
          {(run.trace_url || run.config_url) && (
            <div className="mt-5 flex flex-wrap gap-3">
              {run.config_url ? (
                <a href={run.config_url} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm">Open config artifact</Button>
                </a>
              ) : null}
              {run.trace_url ? (
                <a href={run.trace_url} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm">Open trace artifact</Button>
                </a>
              ) : null}
            </div>
          )}
        </Card>
      </Reveal>

      <Reveal>
        <Card padding="lg" className="h-full">
          <h2 className="font-serif text-xl text-fg">Raw metrics</h2>
          <p className="mt-1 font-mono text-xs text-fg-muted">
            The full metrics blob as stored by the server.
          </p>
          <pre className="mt-4 max-h-80 overflow-auto rounded-md border border-border bg-surface-2 p-4 font-mono text-xs leading-6 text-fg">
            {safeStringify(metrics)}
          </pre>
        </Card>
      </Reveal>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// Skeleton (initial load)
// ---------------------------------------------------------------------------

function RunViewerSkeleton() {
  return (
    <section className="pb-16">
      <Skeleton className="h-4 w-24" />
      <div className="mt-5 border-b border-border pb-7">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-9 w-72 max-w-full" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} padding="md">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-5 h-2 w-full" />
          </Card>
        ))}
      </div>
      <Skeleton className="mt-9 h-9 w-60 rounded-full" />
      <Card padding="lg" className="mt-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{ unserialisable }";
  }
}

function formatDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
