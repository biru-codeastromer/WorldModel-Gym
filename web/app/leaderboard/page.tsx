"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Trophy, Upload } from "lucide-react";

import { LeaderboardChart } from "@/components/leaderboard-chart";
import { Reveal } from "@/components/motion";
import { GridWorld } from "@/components/visuals";
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
 * The leaderboard row schema is strict, so CI / fidelity extras are stripped at
 * parse time and won't be present at runtime. We still probe defensively so the
 * CI whisker lights up automatically if the API/zod schema later surfaces it,
 * without touching lib/api.ts here.
 */
function readCiHalfWidth(row: LeaderboardRow): number | undefined {
  const ci = (row as { success_rate_ci?: unknown }).success_rate_ci;
  if (!Array.isArray(ci) || ci.length < 2) return undefined;
  const lo = toFiniteNumber(ci[0]);
  const hi = toFiniteNumber(ci[1]);
  if (lo === null || hi === null) return undefined;
  return Math.abs(hi - lo) / 2;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [track, setTrack] = useState<Track>("test");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leaderboard", track],
    queryFn: () => fetchLeaderboard(track)
  });

  const rows = useMemo(() => data ?? [], [data]);

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
            <RankingTable rows={rows} onOpen={(id) => router.push(`/runs/${id}`)} />
          </>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RankingTable({
  rows,
  onOpen
}: {
  rows: LeaderboardRow[];
  onOpen: (runId: string) => void;
}) {
  return (
    <Reveal>
      <SectionHeader
        as="h2"
        kicker="Rankings"
        title="The full board"
        className="mb-5"
      />
      <TableContainer className="shadow-sm">
        <Table className="min-w-[760px]">
          <THead sticky>
            <TR>
              <TH className="w-16">Rank</TH>
              <TH>Run</TH>
              <TH>Env</TH>
              <TH>Agent</TH>
              <TH className="min-w-[180px]">Success rate</TH>
              <TH className="text-right">Return</TH>
              <TH className="text-right">Cost (ms/step)</TH>
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
