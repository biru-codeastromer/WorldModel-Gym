"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps
} from "recharts";

import { Reveal } from "@/components/motion";
import { Badge, Card, Segmented } from "@/components/ui";
import { useTheme } from "@/components/theme";
import { formatMetric, toFiniteNumber, type LeaderboardRow } from "@/lib/api";

type ChartMetric = "success_rate" | "mean_return";

type ChartPalette = {
  accent: string;
  grid: string;
  axis: string;
  surface: string;
  border: string;
  fg: string;
  fgMuted: string;
};

/** Read a CSS custom property off :root, with a hard fallback. */
function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Recharts needs literal color strings, not Tailwind classes, so we resolve the
 * theme tokens off the document at runtime and re-resolve whenever the theme
 * flips. Falls back to the light palette during SSR / before hydration.
 */
function useChartPalette(): ChartPalette {
  const { resolvedTheme } = useTheme();
  const [palette, setPalette] = useState<ChartPalette>({
    accent: "#3760d0",
    grid: "rgba(120, 104, 92, 0.20)",
    axis: "#6f6976",
    surface: "#fffdfb",
    border: "rgba(94, 78, 66, 0.40)",
    fg: "#1d1a24",
    fgMuted: "#5f5867"
  });

  useEffect(() => {
    setPalette({
      accent: readVar("--accent", "#3760d0"),
      grid: readVar("--border", "rgba(120, 104, 92, 0.20)"),
      axis: readVar("--fg-subtle", "#6f6976"),
      surface: readVar("--surface", "#fffdfb"),
      border: readVar("--border-strong", "rgba(94, 78, 66, 0.40)"),
      fg: readVar("--fg", "#1d1a24"),
      fgMuted: readVar("--fg-muted", "#5f5867")
    });
  }, [resolvedTheme]);

  return palette;
}

const METRIC_META: Record<ChartMetric, { label: string; hint: string; unit: string; decimals: number }> = {
  success_rate: { label: "Success rate", hint: "Higher is better", unit: "", decimals: 2 },
  mean_return: { label: "Mean return", hint: "Higher is better", unit: "", decimals: 2 }
};

type ChartDatum = {
  run_id: string;
  label: string;
  env: string;
  agent: string;
  value: number | null;
  rank: number;
};

function shortRun(runId: string): string {
  return runId.length > 10 ? `${runId.slice(0, 8)}…` : runId;
}

function ChartTooltip({
  active,
  payload,
  metric,
  palette
}: TooltipProps<number, string> & { metric: ChartMetric; palette: ChartPalette }) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload as ChartDatum | undefined;
  if (!datum) return null;
  const meta = METRIC_META[metric];
  return (
    <div
      className="rounded-md border bg-surface px-3 py-2 shadow-pop"
      style={{ borderColor: palette.border }}
    >
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-fg-subtle">
        #{datum.rank} · {datum.env}
      </p>
      <p className="mt-1 font-mono text-xs text-fg-muted">{datum.agent}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="font-serif text-2xl leading-none text-fg">
          {formatMetric(datum.value, meta.decimals)}
        </span>
        <span className="font-mono text-[0.7rem] text-fg-subtle">{meta.label}</span>
      </p>
    </div>
  );
}

export function LeaderboardChart({ data }: { data: LeaderboardRow[] }) {
  const [metric, setMetric] = useState<ChartMetric>("success_rate");
  const palette = useChartPalette();
  const reduce = useReducedMotion();
  // Honour prefers-reduced-motion: recharts animates its series independently
  // of our framer-motion gating, so we disable its entrance tween when the user
  // has asked for reduced motion.
  const animate = !reduce;
  const meta = METRIC_META[metric];

  const chartData = useMemo<ChartDatum[]>(
    () =>
      data.map((row, index) => ({
        run_id: row.run_id,
        label: shortRun(row.run_id),
        env: row.env,
        agent: row.agent,
        value: toFiniteNumber(row[metric]),
        rank: index + 1
      })),
    [data, metric]
  );

  const hasData = chartData.some((d) => d.value !== null);
  // success_rate sits in 0..1; mean_return is unbounded, let recharts auto-scale.
  const yDomain: [number | "auto", number | "auto"] =
    metric === "success_rate" ? [0, 1] : ["auto", "auto"];
  const gradientId = `wmg-chart-fill-${metric}`;

  return (
    <Reveal>
      <Card elevation="raised" padding="md" className="overflow-hidden">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-accent">Signal</p>
            <h3 className="mt-2 font-serif text-2xl leading-none text-fg md:text-3xl">
              {meta.label} across runs
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success" variant="outline" className="hidden sm:inline-flex">
              {meta.hint}
            </Badge>
            <Segmented<ChartMetric>
              ariaLabel="Chart metric"
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[
                { value: "success_rate", label: "Success" },
                { value: "mean_return", label: "Return" }
              ]}
            />
          </div>
        </div>

        {hasData ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {metric === "success_rate" ? (
                <AreaChart data={chartData} margin={{ top: 8, left: -16, right: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={palette.accent} stopOpacity={0.34} />
                      <stop offset="100%" stopColor={palette.accent} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={palette.grid} strokeDasharray="3 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: palette.axis, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={{ stroke: palette.grid }}
                    interval="preserveStartEnd"
                    height={28}
                  />
                  <YAxis
                    domain={yDomain}
                    width={44}
                    tick={{ fontSize: 11, fill: palette.axis, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ stroke: palette.accent, strokeOpacity: 0.4, strokeWidth: 1 }}
                    content={<ChartTooltip metric={metric} palette={palette} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={palette.accent}
                    fill={`url(#${gradientId})`}
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: palette.accent, strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: palette.accent, stroke: palette.surface, strokeWidth: 2 }}
                    isAnimationActive={animate}
                    animationDuration={700}
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 8, left: -16, right: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={palette.accent} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={palette.accent} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={palette.grid} strokeDasharray="3 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: palette.axis, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={{ stroke: palette.grid }}
                    interval="preserveStartEnd"
                    height={28}
                  />
                  <YAxis
                    domain={yDomain}
                    width={44}
                    tick={{ fontSize: 11, fill: palette.axis, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: palette.accent, fillOpacity: 0.08 }}
                    content={<ChartTooltip metric={metric} palette={palette} />}
                  />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]} isAnimationActive={animate} animationDuration={700}>
                    {chartData.map((d) => (
                      <Cell key={d.run_id} fill={`url(#${gradientId})`} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-md bg-surface-2">
            <p className="font-mono text-sm text-fg-subtle">No {meta.label.toLowerCase()} values to plot.</p>
          </div>
        )}
      </Card>
    </Reveal>
  );
}
