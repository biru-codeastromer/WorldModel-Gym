"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, GitCompareArrows, Trophy, Upload, X } from "lucide-react";

import { LeaderboardChart } from "@/components/leaderboard-chart";
import { Reveal } from "@/components/motion";
import { GridWorld } from "@/components/visuals";
import { compareHref, MAX_COMPARE } from "@/lib/compare";
import {
  Badge,
  Button,
  Card,
  CountUp,
  MetricBar,
  RankBadge,
  Section,
  SectionHeader,
  Segmented,
  Skeleton,
  Stat,
  Table,
  TableContainer,
  TBody,
  TD,
  TH,
  THead,
  Tooltip,
  TR
} from "@/components/ui";
import { fetchLeaderboard, formatMetric, toFiniteNumber, type LeaderboardRow } from "@/lib/api";

type Track = "test" | "train" | "continual";

const TRACK_OPTIONS: { value: Track; label: string }[] = [
  { value: "test", label: "test" },
  { value: "train", label: "train" },
  { value: "continual", label: "continual" }
];

/**
 * Half-width of the success-rate confidence interval, or undefined when the row
 * carries no usable CI. The server now surfaces success_rate_ci as an ordered
 * [low, high] pair (NaN-guarded by ConfidenceIntervalSchema in lib/api.ts); we
 * still re-check shape and finiteness here so a partial pair degrades to "no
 * whisker" instead of drawing a bogus range.
 */
function readCiHalfWidth(row: LeaderboardRow): number | undefined {
  const ci = row.success_rate_ci;
  if (!Array.isArray(ci) || ci.length < 2) return undefined;
  const lo = toFiniteNumber(ci[0]);
  const hi = toFiniteNumber(ci[1]);
  if (lo === null || hi === null) return undefined;
  return Math.abs(hi - lo) / 2;
}

/** Rollout horizons shown in the fidelity column, nearest-first. */
const FIDELITY_HORIZONS = ["k1", "k5", "k20"] as const;

type FidelityReading = {
  /** Headline score (nearest available horizon) shown in the cell. */
  headline: number;
  /** Label of the headline horizon, e.g. "k1". */
  headlineLabel: string;
  /** Every finite horizon score, for the breakdown tooltip. */
  horizons: { label: string; value: number }[];
};

/**
 * Extract a row's model-fidelity scores, or null when none are usable. The
 * headline is the nearest available horizon (k1 → k5 → k20); the full set feeds
 * a breakdown tooltip. Returns null for absent/empty/all-NaN fidelity so the
 * optional column can hide itself when no row carries data.
 */
function readModelFidelity(row: LeaderboardRow): FidelityReading | null {
  const fidelity = row.model_fidelity;
  if (!fidelity || typeof fidelity !== "object") return null;
  const source = fidelity as Record<string, unknown>;
  const horizons: { label: string; value: number }[] = [];
  for (const label of FIDELITY_HORIZONS) {
    const value = toFiniteNumber(source[label]);
    if (value !== null) horizons.push({ label, value });
  }
  if (horizons.length === 0) return null;
  const [headline] = horizons;
  return { headline: headline.value, headlineLabel: headline.label, horizons };
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [track, setTrack] = useState<Track>("test");
  // Ordered selection of run ids for the side-by-side comparison view, capped
  // at MAX_COMPARE. Kept as an array so /compare columns honour click order.
  const [selected, setSelected] = useState<string[]>([]);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leaderboard", track],
    queryFn: () => fetchLeaderboard(track)
  });

  const rows = useMemo(() => data ?? [], [data]);

  const toggleSelected = useCallback((runId: string) => {
    setSelected((prev) => {
      if (prev.includes(runId)) {
        return prev.filter((id) => id !== runId);
      }
      // Ignore selections beyond the cap (the checkbox is disabled too).
      if (prev.length >= MAX_COMPARE) {
        return prev;
      }
      return [...prev, runId];
    });
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  // Drop selections that are no longer on the visible track without an effect:
  // the action bar only links to ids that still exist in `rows`.
  const selectedOnTrack = useMemo(() => {
    const present = new Set(rows.map((r) => r.run_id));
    return selected.filter((id) => present.has(id));
  }, [rows, selected]);

  const successValues = rows
    .map((row) => toFiniteNumber(row.success_rate))
    .filter((value): value is number => value !== null);
  const planningValues = rows
    .map((row) => toFiniteNumber(row.planning_cost_ms_per_step))
    .filter((value): value is number => value !== null);
  const topSuccess = successValues.length > 0 ? Math.max(...successValues) : null;
  const fastestPlanner = planningValues.length > 0 ? Math.min(...planningValues) : null;

  return (
    <div className="pb-8">
      {/* ---- Compact hero ---- */}
      <Section className="border-b border-border pt-2 md:pt-4">
        <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <Reveal>
            <SectionHeader
              as="h1"
              kicker="Leaderboards"
              title="Benchmark rankings, not cherry-picked slides."
              lede="Compare planning quality, return, and per-step cost across live tracks, then jump straight into the run behind each row."
            />
            <div className="mt-7 grid grid-cols-3 gap-4 sm:max-w-md">
              <Stat
                label="Live runs"
                value={<CountUp value={rows.length} />}
              />
              <Stat
                label="Best success"
                value={
                  topSuccess !== null ? <CountUp value={topSuccess} decimals={2} /> : "--"
                }
              />
              <Stat
                label="Fastest"
                value={
                  fastestPlanner !== null ? (
                    <CountUp value={fastestPlanner} decimals={1} />
                  ) : (
                    "--"
                  )
                }
                unit={fastestPlanner !== null ? "ms" : undefined}
              />
            </div>
          </Reveal>

          <Reveal direction="left" delay={0.1} className="hidden lg:block">
            <Card inset elevation="flat" padding="md" className="paper-matrix">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-fg-subtle">
                  Env preview
                </span>
                <Badge tone="accent" variant="soft">
                  {track}
                </Badge>
              </div>
              <GridWorld className="mt-4 h-auto w-full" />
            </Card>
          </Reveal>
        </div>
      </Section>

      {/* ---- Track switcher ---- */}
      <Section className="!py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmented<Track>
            ariaLabel="Leaderboard track"
            value={track}
            onChange={setTrack}
            options={TRACK_OPTIONS}
          />
          <p className="font-mono text-xs text-fg-subtle">
            {isLoading
              ? "Loading rankings…"
              : `${rows.length} ${rows.length === 1 ? "run" : "runs"} on the ${track} track`}
          </p>
        </div>
      </Section>

      {/* ---- Panel ---- */}
      <div
        id="leaderboard-panel"
        role="tabpanel"
        aria-label={`${track} leaderboard`}
        className="space-y-10"
      >
        {isLoading ? <LoadingState /> : null}

        {isError ? (
          <ErrorState message={error instanceof Error ? error.message : undefined} />
        ) : null}

        {!isLoading && !isError && rows.length === 0 ? <EmptyState /> : null}

        {!isLoading && !isError && rows.length > 0 ? (
          <>
            <LeaderboardChart data={rows} />
            <RankingTable
              rows={rows}
              onOpen={(id) => router.push(`/runs/${id}`)}
              selected={selected}
              onToggleSelected={toggleSelected}
            />
          </>
        ) : null}
      </div>

      <CompareBar selected={selectedOnTrack} onClear={clearSelection} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Sticky/floating action bar that appears once one or more runs are selected.
 * Links to /compare?runs=id1,id2,... and is fully keyboard-accessible. The
 * "Compare" CTA is disabled until at least two runs are chosen.
 */
function CompareBar({
  selected,
  onClear
}: {
  selected: string[];
  onClear: () => void;
}) {
  const count = selected.length;
  const canCompare = count >= 2;
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
        >
          <div
            role="region"
            aria-label="Run comparison selection"
            className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-full border border-border-strong bg-surface/95 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-surface/80"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 font-mono text-xs text-fg" aria-live="polite">
              <span className="font-semibold text-fg">{count}</span>{" "}
              {count === 1 ? "run" : "runs"} selected
              <span className="ml-1 hidden text-fg-subtle sm:inline">· max {MAX_COMPARE}</span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              leftIcon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Clear
            </Button>
            {canCompare ? (
              <Link href={compareHref(selected)}>
                <Button variant="primary" size="sm">
                  Compare {count} runs
                </Button>
              </Link>
            ) : (
              <Button variant="primary" size="sm" disabled aria-disabled="true">
                Compare {count} runs
              </Button>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */

function RankingTable({
  rows,
  onOpen,
  selected,
  onToggleSelected
}: {
  rows: LeaderboardRow[];
  onOpen: (runId: string) => void;
  selected: string[];
  onToggleSelected: (runId: string) => void;
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const atCap = selected.length >= MAX_COMPARE;
  // Only mount the fidelity column when at least one visible row carries a
  // usable model_fidelity score, so tracks without it don't show a "--" column.
  const showFidelity = useMemo(() => rows.some((row) => readModelFidelity(row) !== null), [rows]);
  return (
    <Reveal>
      <SectionHeader
        as="h2"
        kicker="Rankings"
        title="The full board"
        className="mb-5"
      />
      <TableContainer className="shadow-sm">
        <Table className="min-w-[800px]">
          <THead sticky>
            <TR>
              <TH className="w-10">
                <span className="sr-only">Select for comparison</span>
              </TH>
              <TH className="w-16">Rank</TH>
              <TH>Run</TH>
              <TH>Env</TH>
              <TH>Agent</TH>
              <TH className="min-w-[180px]">Success rate</TH>
              <TH className="text-right">Return</TH>
              <TH className="text-right">Cost (ms/step)</TH>
              {showFidelity ? <TH className="text-right">Fidelity</TH> : null}
              <TH className="w-10 text-right">
                <span className="sr-only">Open run</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row, index) => {
              const rank = index + 1;
              const success = toFiniteNumber(row.success_rate);
              const ci = readCiHalfWidth(row);
              const fidelity = readModelFidelity(row);
              const isSelected = selectedSet.has(row.run_id);
              const selectDisabled = !isSelected && atCap;
              const tone =
                success === null
                  ? "accent"
                  : success >= 0.66
                    ? "success"
                    : success >= 0.33
                      ? "warning"
                      : "danger";
              return (
                <TR
                  key={row.run_id}
                  interactive
                  tabIndex={0}
                  role="link"
                  aria-label={`Open run ${row.run_id}, rank ${rank}`}
                  onClick={() => onOpen(row.run_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(row.run_id);
                    }
                  }}
                  className="group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <TD className="w-10">
                    <SelectCell
                      runId={row.run_id}
                      checked={isSelected}
                      disabled={selectDisabled}
                      onToggle={onToggleSelected}
                    />
                  </TD>
                  <TD>
                    {rank <= 3 ? (
                      <Tooltip content={`Rank ${rank} of ${rows.length}`}>
                        <span className="inline-flex">
                          <RankBadge rank={rank} />
                        </span>
                      </Tooltip>
                    ) : (
                      <RankBadge rank={rank} />
                    )}
                  </TD>
                  <TD>
                    <span className="font-mono text-xs text-fg group-hover:text-accent">
                      {row.run_id}
                    </span>
                  </TD>
                  <TD>
                    <Badge tone="neutral" variant="outline">
                      {row.env}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone="accent" variant="soft">
                      {row.agent}
                    </Badge>
                  </TD>
                  <TD>
                    {success !== null ? (
                      <MetricBar value={success} ci={ci} tone={tone} />
                    ) : (
                      <span className="font-mono text-xs text-fg-subtle">--</span>
                    )}
                  </TD>
                  <TD className="text-right font-mono text-sm tabular-nums">
                    {formatMetric(row.mean_return, 2)}
                  </TD>
                  <TD className="text-right font-mono text-sm tabular-nums text-fg-muted">
                    {formatMetric(row.planning_cost_ms_per_step, 2)}
                  </TD>
                  {showFidelity ? (
                    <TD className="text-right">
                      {fidelity ? (
                        <Tooltip
                          content={fidelity.horizons
                            .map((h) => `${h.label} ${formatMetric(h.value, 2)}`)
                            .join(" · ")}
                        >
                          <span className="inline-flex items-baseline gap-1 font-mono text-sm tabular-nums">
                            <span className="text-[0.65rem] tracking-wide text-fg-subtle">
                              {fidelity.headlineLabel}
                            </span>
                            {formatMetric(fidelity.headline, 2)}
                          </span>
                        </Tooltip>
                      ) : (
                        <span className="font-mono text-xs text-fg-subtle">--</span>
                      )}
                    </TD>
                  ) : null}
                  <TD className="text-right">
                    <ArrowUpRight
                      className="ml-auto h-4 w-4 text-fg-subtle transition-colors group-hover:text-accent"
                      aria-hidden="true"
                    />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>
    </Reveal>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Per-row comparison toggle. Rendered as a real <input type="checkbox"> for
 * keyboard + screen-reader support. All pointer/keyboard events stop
 * propagation so toggling never triggers the surrounding row's link navigation
 * (Enter/Space on the row open the run; here they toggle selection instead).
 */
function SelectCell({
  runId,
  checked,
  disabled,
  onToggle
}: {
  runId: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (runId: string) => void;
}) {
  return (
    <label
      className="inline-flex cursor-pointer items-center justify-center p-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={
          disabled
            ? `Selection full (max ${MAX_COMPARE} runs)`
            : `${checked ? "Remove" : "Add"} run ${runId} ${checked ? "from" : "to"} comparison`
        }
        onChange={() => onToggle(runId)}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4 cursor-pointer rounded border-border-strong text-accent accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading leaderboard">
      <Card elevation="raised" padding="md">
        <div className="mb-5 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </Card>
      <TableContainer>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="h-7 w-7" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="ml-auto h-2.5 w-40 rounded-full" />
            </div>
          ))}
        </div>
      </TableContainer>
    </div>
  );
}

function ErrorState({ message }: { message?: string }) {
  return (
    <Reveal>
      <Card elevation="raised" padding="lg" className="border-warning/40 bg-warning-soft">
        <Badge tone="warning" variant="soft">
          Live API unavailable
        </Badge>
        <h3 className="mt-4 font-serif text-2xl leading-snug text-fg md:text-3xl">
          The leaderboard is live, but the backend is not serving results right now.
        </h3>
        <p className="mt-3 max-w-2xl font-mono text-sm leading-7 text-fg-muted">
          {message ?? "Failed to load leaderboard data."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/">
            <Button variant="primary" size="md">
              Back to Home
            </Button>
          </Link>
          <Link href="/tasks">
            <Button variant="secondary" size="md">
              Browse tasks instead
            </Button>
          </Link>
        </div>
      </Card>
    </Reveal>
  );
}

function EmptyState() {
  return (
    <Reveal>
      <Card
        elevation="flat"
        padding="lg"
        inset
        className="border-dashed text-center"
      >
        <div className="mx-auto flex max-w-md flex-col items-center">
          <div className="relative mb-6 h-32 w-32">
            <GridWorld className="h-full w-full opacity-90" />
            <span className="absolute -right-2 -top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-fg-subtle">
            No runs yet
          </p>
          <h3 className="mt-3 font-serif text-2xl leading-snug text-fg md:text-3xl">
            This track is waiting for its first evaluation.
          </h3>
          <p className="mt-3 font-mono text-sm leading-7 text-fg-muted">
            Publish through the browser upload flow or the API/CLI helper to populate rankings,
            charts, and run pages.
          </p>
          <div className="mt-6">
            <Link href="/upload">
              <Button variant="primary" size="md" leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}>
                Upload a run
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </Reveal>
  );
}
