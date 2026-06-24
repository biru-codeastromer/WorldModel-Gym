"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight, BarChart3, Boxes, Layers } from "lucide-react";

import { fetchTasks, TaskRecord } from "@/lib/api";
import { Reveal, useHoverLift } from "@/components/motion";
import {
  Badge,
  type BadgeTone,
  Card,
  Section,
  SectionHeader,
  Skeleton,
  cn
} from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Fallback data (shown if live discovery fails)                              */
/* -------------------------------------------------------------------------- */

const curatedTasks: TaskRecord[] = [
  {
    id: "memory_maze",
    description:
      "Navigate a key-door dependency chain under limited field of view and delayed reward.",
    defaults: { obs_mode: "both", reward_type: "sparse" }
  },
  {
    id: "switch_quest",
    description:
      "Discover and execute a hidden subgoal sequence with incomplete observations.",
    defaults: { obs_mode: "symbolic", chain_length: 4 }
  },
  {
    id: "craft_lite",
    description:
      "Plan over resource collection and crafting dependencies under tight budgets.",
    defaults: { inventory_limit: 6, sparse_mode: true }
  }
];

/* -------------------------------------------------------------------------- */
/* On-brand env glyphs — code-built SVG, theme-aware, decorative              */
/* -------------------------------------------------------------------------- */

type GlyphProps = { className?: string };

/** memory_maze — a winding key→door dependency path through a fogged grid. */
function MemoryMazeGlyph({ className }: GlyphProps) {
  const cells = Array.from({ length: 36 }, (_, i) => i);
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className={cn("text-fg-muted", className)}>
      {cells.map((i) => {
        const c = i % 6;
        const r = Math.floor(i / 6);
        return (
          <rect
            key={i}
            x={c * 16.67}
            y={r * 16.67}
            width={16.67}
            height={16.67}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.16}
            strokeWidth={0.5}
          />
        );
      })}
      {/* fog-of-war veil over far cells */}
      <rect x="50" y="0" width="50" height="50" className="fill-fg-subtle" opacity={0.06} />
      {/* walls */}
      {[
        [16.67, 16.67, 1.4, 33.4],
        [50, 33.4, 33.4, 1.4],
        [33.4, 66.7, 1.4, 18]
      ].map(([x, y, w, h], i) => (
        <rect key={`w-${i}`} x={x} y={y} width={w} height={h} rx={0.6} className="fill-fg-subtle" opacity={0.5} />
      ))}
      {/* winding planned path */}
      <polyline
        points="8.3,91.5 8.3,58 25,58 25,41 58,41 58,25 91.5,25"
        fill="none"
        className="stroke-accent"
        strokeWidth={1.6}
        strokeDasharray="2 2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
      {/* key (mid-path) */}
      <g className="text-warning" transform="translate(25 41)">
        <circle r={3.4} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <line x1={2.4} y1={2.4} x2={6} y2={6} stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        <line x1={5} y1={6} x2={6.6} y2={6} stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      </g>
      {/* agent (start) */}
      <circle cx={8.3} cy={91.5} r={4} className="fill-accent-soft" />
      <circle cx={8.3} cy={91.5} r={2} className="fill-accent" />
      {/* door / goal */}
      <rect x={86} y={19} r={1.5} width={11} height={12} rx={1.5} className="fill-success-soft" />
      <rect x={89} y={22} width={5} height={6} rx={1} className="fill-success" />
    </svg>
  );
}

/** switch_quest — a branching subgoal chain with one lit "discovered" branch. */
function SwitchQuestGlyph({ className }: GlyphProps) {
  const nodes = {
    root: [16, 50],
    a: [42, 24],
    b: [42, 50],
    c: [42, 76],
    goal: [82, 24]
  } as const;
  const edges: Array<[keyof typeof nodes, keyof typeof nodes, boolean]> = [
    ["root", "a", true],
    ["root", "b", false],
    ["root", "c", false],
    ["a", "goal", true]
  ];
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className={cn("text-fg-muted", className)}>
      {/* dotted backdrop */}
      <pattern id="sq-dots" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.7" fill="currentColor" opacity={0.12} />
      </pattern>
      <rect x="0" y="0" width="100" height="100" fill="url(#sq-dots)" />
      {edges.map(([from, to, lit], i) => {
        const [x1, y1] = nodes[from];
        const [x2, y2] = nodes[to];
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={lit ? "stroke-accent" : "stroke-fg-subtle"}
            strokeWidth={lit ? 1.8 : 1.1}
            strokeDasharray={lit ? undefined : "2 2.2"}
            opacity={lit ? 0.85 : 0.55}
            strokeLinecap="round"
          />
        );
      })}
      {/* switches (subgoal nodes) */}
      {(["b", "c"] as const).map((k) => {
        const [x, y] = nodes[k];
        return <circle key={k} cx={x} cy={y} r={3.6} className="fill-surface-3 stroke-fg-subtle" strokeWidth={1} />;
      })}
      {/* discovered switch (lit) */}
      <circle cx={nodes.a[0]} cy={nodes.a[1]} r={4.4} className="fill-accent-soft" />
      <circle cx={nodes.a[0]} cy={nodes.a[1]} r={2.2} className="fill-accent" />
      {/* root / agent */}
      <circle cx={nodes.root[0]} cy={nodes.root[1]} r={4.6} className="fill-accent-soft" />
      <rect x={nodes.root[0] - 2.2} y={nodes.root[1] - 2.2} width={4.4} height={4.4} rx={1} className="fill-accent" />
      {/* goal */}
      <circle cx={nodes.goal[0]} cy={nodes.goal[1]} r={4.6} className="fill-success-soft" />
      <circle cx={nodes.goal[0]} cy={nodes.goal[1]} r={2.2} className="fill-success" />
    </svg>
  );
}

/** craft_lite — a crafting dependency tree: raw resources → intermediate → item. */
function CraftLiteGlyph({ className }: GlyphProps) {
  const raw = [
    [16, 78],
    [16, 50],
    [16, 22]
  ];
  const mid = [
    [50, 64],
    [50, 30]
  ];
  const out = [84, 47];
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className={cn("text-fg-muted", className)}>
      <pattern id="cl-dots" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.7" fill="currentColor" opacity={0.1} />
      </pattern>
      <rect x="0" y="0" width="100" height="100" fill="url(#cl-dots)" />
      {/* edges raw -> mid */}
      {[
        [raw[0], mid[0]],
        [raw[1], mid[0]],
        [raw[1], mid[1]],
        [raw[2], mid[1]]
      ].map(([a, b], i) => (
        <line
          key={`e1-${i}`}
          x1={a[0]}
          y1={a[1]}
          x2={b[0]}
          y2={b[1]}
          className="stroke-fg-subtle"
          strokeWidth={1.1}
          opacity={0.5}
          strokeLinecap="round"
        />
      ))}
      {/* edges mid -> out (crafted path lit) */}
      {[mid[0], mid[1]].map((m, i) => (
        <line
          key={`e2-${i}`}
          x1={m[0]}
          y1={m[1]}
          x2={out[0]}
          y2={out[1]}
          className="stroke-accent"
          strokeWidth={1.6}
          opacity={0.8}
          strokeLinecap="round"
        />
      ))}
      {/* raw resource diamonds */}
      {raw.map(([x, y], i) => (
        <rect
          key={`r-${i}`}
          x={x - 3.4}
          y={y - 3.4}
          width={6.8}
          height={6.8}
          rx={1.2}
          transform={`rotate(45 ${x} ${y})`}
          className="fill-surface-3 stroke-fg-subtle"
          strokeWidth={1}
        />
      ))}
      {/* intermediate craft nodes */}
      {mid.map(([x, y], i) => (
        <g key={`m-${i}`}>
          <circle cx={x} cy={y} r={4.2} className="fill-accent-soft" />
          <circle cx={x} cy={y} r={2} className="fill-accent" />
        </g>
      ))}
      {/* output item (goal) */}
      <rect x={out[0] - 5} y={out[1] - 5} width={10} height={10} rx={2} className="fill-success-soft" />
      <rect x={out[0] - 2.4} y={out[1] - 2.4} width={4.8} height={4.8} rx={1} className="fill-success" />
    </svg>
  );
}

/** Generic fallback glyph for any unknown env id — a neutral grid + path. */
function GenericEnvGlyph({ className }: GlyphProps) {
  const cells = Array.from({ length: 36 }, (_, i) => i);
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className={cn("text-fg-muted", className)}>
      {cells.map((i) => {
        const c = i % 6;
        const r = Math.floor(i / 6);
        return (
          <rect
            key={i}
            x={c * 16.67}
            y={r * 16.67}
            width={16.67}
            height={16.67}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.16}
            strokeWidth={0.5}
          />
        );
      })}
      <polyline
        points="8.3,91.5 25,91.5 25,58 58,58 58,25 91.5,25"
        fill="none"
        className="stroke-accent"
        strokeWidth={1.6}
        strokeDasharray="2 2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
      <circle cx={8.3} cy={91.5} r={4} className="fill-accent-soft" />
      <circle cx={8.3} cy={91.5} r={2} className="fill-accent" />
      <circle cx={91.5} cy={25} r={4} className="fill-success-soft" />
      <circle cx={91.5} cy={25} r={2} className="fill-success" />
    </svg>
  );
}

const GLYPHS: Record<string, (p: GlyphProps) => ReactNode> = {
  memory_maze: MemoryMazeGlyph,
  switch_quest: SwitchQuestGlyph,
  craft_lite: CraftLiteGlyph
};

function EnvGlyph({ id, className }: { id: string; className?: string }) {
  const Glyph = GLYPHS[id] ?? GenericEnvGlyph;
  return <Glyph className={className} />;
}

/* -------------------------------------------------------------------------- */
/* Derived property badges (from the task's defaults — no data shape changes) */
/* -------------------------------------------------------------------------- */

type Property = { label: string; tone: BadgeTone };

function deriveProperties(task: TaskRecord): Property[] {
  const props: Property[] = [];
  const d = task.defaults ?? {};
  const obs = String(d.obs_mode ?? "").toLowerCase();
  const reward = String(d.reward_type ?? "").toLowerCase();

  // Partial observability → POMDP
  if (obs === "symbolic" || obs === "both" || "obs_mode" in d) {
    props.push({ label: "POMDP", tone: "accent" });
  }
  // Sparse reward signal
  if (reward === "sparse" || d.sparse_mode === true) {
    props.push({ label: "Sparse reward", tone: "warning" });
  }
  // Long-horizon dependency chains
  if (typeof d.chain_length === "number" && d.chain_length >= 3) {
    props.push({ label: "Long horizon", tone: "neutral" });
  }
  // Resource/inventory planning
  if ("inventory_limit" in d) {
    props.push({ label: "Resource planning", tone: "neutral" });
  }
  // Every benchmark world is procedurally generated
  props.push({ label: "Procedural", tone: "neutral" });

  return props;
}

/** A rough qualitative difficulty cue derived from the property mix. */
function difficultyFor(task: TaskRecord): { label: string; tone: BadgeTone } {
  const d = task.defaults ?? {};
  const chain = typeof d.chain_length === "number" ? d.chain_length : 0;
  const sparse = d.reward_type === "sparse" || d.sparse_mode === true;
  if (chain >= 4 || (sparse && "inventory_limit" in d)) {
    return { label: "Hard", tone: "danger" };
  }
  if (sparse || chain >= 2) {
    return { label: "Medium", tone: "warning" };
  }
  return { label: "Standard", tone: "success" };
}

function defaultPills(defaults?: Record<string, unknown>) {
  const entries = Object.entries(defaults ?? {});
  if (entries.length === 0) {
    return <span className="font-mono text-xs text-fg-subtle">No defaults available</span>;
  }
  return entries.map(([key, value]) => (
    <span
      key={key}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-[0.7rem] text-fg-muted"
    >
      <span className="text-fg-subtle">{key}</span>
      <span className="text-fg">{String(value)}</span>
    </span>
  ));
}

/* -------------------------------------------------------------------------- */
/* Link-as-button styles (matches the Button primitive, but navigable)        */
/* -------------------------------------------------------------------------- */

const ctaBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 font-mono text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const ctaPrimary = "bg-accent text-accent-fg hover:bg-accent-hover";
const ctaSecondary = "border border-border-strong bg-surface text-fg hover:bg-surface-2";

/* -------------------------------------------------------------------------- */
/* Task card                                                                  */
/* -------------------------------------------------------------------------- */

function TaskCard({ task, live }: { task: TaskRecord; live: boolean }) {
  const lift = useHoverLift(4);
  const properties = deriveProperties(task);
  const difficulty = difficultyFor(task);
  const titleId = `task-${task.id}-title`;

  return (
    <Reveal className="h-full">
      <motion.div {...lift} className="h-full">
        <Card
          elevation="raised"
          padding="none"
          className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg"
        >
          {/* glyph header */}
          <div className="relative border-b border-border bg-bg-soft px-6 pb-2 pt-6">
            <div className="flex items-start justify-between gap-3">
              <Badge tone={difficulty.tone} variant="soft">
                {difficulty.label}
              </Badge>
              <Badge tone={live ? "success" : "neutral"} variant="outline">
                {live ? "Live" : "Fallback"}
              </Badge>
            </div>
            <div className="mx-auto flex max-w-[180px] items-center justify-center py-2">
              <EnvGlyph
                id={task.id}
                className="h-32 w-32 transition-transform duration-300 ease-out group-hover:scale-[1.04]"
              />
            </div>
          </div>

          {/* body */}
          <div className="flex flex-1 flex-col gap-4 p-6">
            <div>
              <h3
                id={titleId}
                className="font-serif text-2xl leading-tight tracking-[-0.01em] text-fg"
              >
                {task.id}
              </h3>
              <p className="mt-2 font-mono text-sm leading-6 text-fg-muted">{task.description}</p>
            </div>

            {/* property badges */}
            <ul className="flex flex-wrap gap-2" aria-label="Environment properties">
              {properties.map((p) => (
                <li key={p.label}>
                  <Badge tone={p.tone}>{p.label}</Badge>
                </li>
              ))}
            </ul>

            {/* defaults */}
            <div>
              <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-fg-subtle">
                Defaults
              </p>
              <div className="flex flex-wrap gap-1.5">{defaultPills(task.defaults)}</div>
            </div>

            {/* CTAs pinned to the bottom */}
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Link
                href={`/upload?env=${encodeURIComponent(task.id)}&track=test`}
                aria-label={`Upload a run for ${task.id}`}
                className={cn(ctaBase, ctaPrimary)}
              >
                Upload run
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/leaderboard"
                aria-label={`Compare ${task.id} on the leaderboard`}
                className={cn(ctaBase, ctaSecondary)}
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Compare
              </Link>
            </div>
          </div>
        </Card>
      </motion.div>
    </Reveal>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton + empty states                                                    */
/* -------------------------------------------------------------------------- */

function TaskCardSkeleton() {
  return (
    <Card elevation="raised" padding="none" className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border bg-bg-soft px-6 pb-6 pt-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="mx-auto mt-3 flex justify-center">
          <Skeleton className="h-28 w-28 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="mt-auto flex gap-2 pt-2">
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card
      elevation="flat"
      padding="lg"
      className="flex flex-col items-center gap-4 border-dashed bg-bg-soft py-16 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Boxes className="h-7 w-7" aria-hidden="true" />
      </span>
      <div className="max-w-md">
        <h3 className="font-serif text-2xl text-fg">No environments yet</h3>
        <p className="mt-2 font-mono text-sm leading-6 text-fg-muted">
          The benchmark gallery is empty right now. Once environments are registered they will appear
          here, ready to upload runs against and compare on the leaderboard.
        </p>
      </div>
      <Link href="/leaderboard" className={cn(ctaBase, ctaSecondary)}>
        View the leaderboard
      </Link>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function TasksPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks
  });

  const tasks = data?.tasks ?? [];
  const usingFallback = isError;
  const visibleTasks = usingFallback ? curatedTasks : tasks;
  const live = !usingFallback;

  return (
    <Section className="py-10 md:py-12">
      {/* compact header — product visible above the fold */}
      <Reveal>
        <SectionHeader
          as="h1"
          kicker="Benchmark environments"
          title="Worlds built to test planning, memory, and imagination"
          lede="Each environment ships with deterministic defaults and track-ready metadata. Pick one to upload a run or compare agents on the leaderboard."
          action={
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-xs text-fg-muted">
              <Layers className="h-4 w-4 text-accent" aria-hidden="true" />
              {isLoading ? "Loading…" : `${visibleTasks.length} environment${visibleTasks.length === 1 ? "" : "s"}`}
            </span>
          }
        />
      </Reveal>

      {/* fallback notice */}
      {usingFallback ? (
        <Reveal className="mt-6" direction="none">
          <Card
            elevation="flat"
            padding="sm"
            className="border-warning/40 bg-warning-soft text-warning"
            role="status"
          >
            <p className="font-mono text-sm">
              Live task discovery is unavailable — showing curated benchmark environments instead.
            </p>
          </Card>
        </Reveal>
      ) : null}

      {/* grid */}
      <div className="mt-10">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <TaskCardSkeleton key={i} />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <Reveal>
            <EmptyState />
          </Reveal>
        ) : (
          <Reveal group className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTasks.map((task) => (
              <TaskCard key={task.id} task={task} live={live} />
            ))}
          </Reveal>
        )}
      </div>
    </Section>
  );
}
