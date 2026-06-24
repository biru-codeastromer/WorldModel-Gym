"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Boxes,
  BarChart3,
  Upload,
  Database,
  Server,
  Layers,
  Workflow
} from "lucide-react";

import { WorkflowShowcase } from "@/components/workflow-showcase";
import { Reveal, useHoverLift } from "@/components/motion";
import {
  Badge,
  Card,
  CountUp,
  MetricBar,
  RankBadge,
  Section,
  SectionHeader,
  cn
} from "@/components/ui";
import { GridWorld, PlannerTree, Sparkline } from "@/components/visuals";

/* ----------------------------- shared link buttons ---------------------------- */

const linkBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-mono font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const linkVariants = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "border border-border-strong bg-surface text-fg hover:bg-surface-2"
} as const;
const linkSizes = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[0.95rem]"
} as const;

function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children
}: {
  href: string;
  variant?: keyof typeof linkVariants;
  size?: keyof typeof linkSizes;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(linkBase, linkVariants[variant], linkSizes[size], className)}
    >
      {children}
    </Link>
  );
}

/* ------------------------------- hero preview -------------------------------- */

type PreviewRow = {
  rank: number;
  agent: string;
  env: string;
  success: number;
  ci: number;
  trend: number[];
  tone: "success" | "accent" | "warning";
};

const previewRows: PreviewRow[] = [
  {
    rank: 1,
    agent: "mu-planner",
    env: "GridWorld-9",
    success: 0.94,
    ci: 0.03,
    trend: [0.71, 0.78, 0.83, 0.88, 0.94],
    tone: "success"
  },
  {
    rank: 2,
    agent: "dreamer-v3",
    env: "GridWorld-9",
    success: 0.88,
    ci: 0.04,
    trend: [0.66, 0.74, 0.79, 0.84, 0.88],
    tone: "accent"
  },
  {
    rank: 3,
    agent: "mcts-base",
    env: "GridWorld-9",
    success: 0.81,
    ci: 0.05,
    trend: [0.6, 0.68, 0.72, 0.77, 0.81],
    tone: "accent"
  },
  {
    rank: 4,
    agent: "random+",
    env: "GridWorld-9",
    success: 0.62,
    ci: 0.06,
    trend: [0.55, 0.58, 0.59, 0.61, 0.62],
    tone: "warning"
  }
];

function HeroPreview() {
  const lift = useHoverLift(2);
  return (
    <motion.div {...lift} className="w-full">
      <Card elevation="pop" padding="none" className="overflow-hidden">
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="font-mono text-xs font-medium text-fg">
              Leaderboard
            </span>
            <Badge tone="accent" variant="soft">
              Test track
            </Badge>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-fg-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            Live
          </span>
        </div>

        {/* rows */}
        <div className="divide-y divide-border" role="list" aria-label="Top runs preview">
          {previewRows.map((row, i) => (
            <Reveal
              key={row.agent}
              role="listitem"
              delay={0.15 + i * 0.08}
              direction="up"
              className="flex items-center gap-3 px-5 py-3.5"
            >
              <RankBadge rank={row.rank} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium text-fg">
                  {row.agent}
                </p>
                <p className="truncate font-mono text-[0.7rem] text-fg-subtle">
                  {row.env}
                </p>
              </div>
              <div className="hidden sm:block">
                <Sparkline data={row.trend} tone={row.tone === "warning" ? "accent" : row.tone} width={64} height={22} />
              </div>
              <div className="w-28 shrink-0 sm:w-36">
                <MetricBar value={row.success} ci={row.ci} tone={row.tone} />
              </div>
            </Reveal>
          ))}
        </div>

        {/* footer stat strip */}
        <div className="grid grid-cols-3 gap-px border-t border-border bg-border">
          {[
            { label: "Runs", value: 248, suffix: "" },
            { label: "Agents", value: 19, suffix: "" },
            { label: "Avg cost", value: 1.4, suffix: "k", decimals: 1 }
          ].map((s) => (
            <div key={s.label} className="bg-surface px-4 py-3">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-fg-subtle">
                {s.label}
              </p>
              <p className="mt-1 font-serif text-xl text-fg">
                <CountUp value={s.value} decimals={s.decimals ?? 0} suffix={s.suffix} />
              </p>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

/* --------------------------------- content ----------------------------------- */

const proofPoints = [
  "Sparse-reward environments with reproducible seeds",
  "Public tracks across test, train, and continual",
  "Browser upload alongside API and CLI submission"
];

const surfaces = [
  {
    icon: Boxes,
    title: "Task library",
    description:
      "Document environments with clear defaults, precise constraints, and readable benchmark framing.",
    href: "/tasks",
    cta: "Browse tasks"
  },
  {
    icon: BarChart3,
    title: "Live leaderboards",
    description:
      "Compare planning quality, return, and cost in one public surface instead of scattered artifacts.",
    href: "/leaderboard",
    cta: "Open leaderboards"
  },
  {
    icon: Upload,
    title: "Upload studio",
    description:
      "Create a run, attach metrics and traces, and publish from the browser — CLI and API still available.",
    href: "/upload",
    cta: "Publish a run"
  }
];

const stats = [
  { label: "Benchmark tasks", value: 24, suffix: "+" },
  { label: "Public runs", value: 248, suffix: "" },
  { label: "Tracks", value: 3, suffix: "" },
  { label: "Best success rate", value: 94, suffix: "%" }
];

const stack = [
  { icon: Server, label: "FastAPI + Postgres + S3" },
  { icon: Layers, label: "Next.js App Router" },
  { icon: Database, label: "Real runs in production" }
];

function SurfaceCard({
  surface
}: {
  surface: (typeof surfaces)[number];
}) {
  const lift = useHoverLift();
  const Icon = surface.icon;
  return (
    <motion.div {...lift} className="h-full">
      <Card
        elevation="raised"
        padding="lg"
        className="group flex h-full flex-col"
      >
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface-2 text-accent">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-5 font-serif text-xl text-fg">{surface.title}</h3>
        <p className="mt-2 flex-1 font-mono text-sm leading-7 text-fg-muted">
          {surface.description}
        </p>
        <Link
          href={surface.href}
          className="mt-5 inline-flex items-center gap-1 font-mono text-sm font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
        >
          {surface.cta}
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
            aria-hidden="true"
          />
        </Link>
      </Card>
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <div className="pb-8">
      {/* ------------------------------ HERO ------------------------------ */}
      <Section className="pt-6 md:pt-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          <div className="max-w-xl">
            <Reveal direction="up">
              <Badge tone="accent" variant="outline">
                Research benchmark platform
              </Badge>
            </Reveal>
            {/* LCP element: render the hero heading immediately at its final
                state (no opacity-gated entrance) so there is zero
                flash-of-invisible above-the-fold text and a fast LCP. Secondary
                hero elements keep their staggered reveal. */}
            <h1 className="mt-5 font-serif text-4xl font-medium leading-[1.04] tracking-[-0.02em] text-fg sm:text-5xl md:text-6xl">
              Benchmark world-model agents in one public surface.
            </h1>
            <Reveal direction="up" delay={0.12}>
              <p className="mt-5 max-w-lg font-mono text-base leading-7 text-fg-muted">
                WorldModel Gym turns environments, uploads, traces, and
                leaderboards into a research instrument you can read at a glance —
                and share with one clean URL.
              </p>
            </Reveal>
            <Reveal direction="up" delay={0.18}>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink href="/upload" size="lg">
                  Get Started
                </ButtonLink>
                <ButtonLink href="/leaderboard" variant="secondary" size="lg">
                  View Leaderboard
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal group className="mt-8 space-y-2.5" delay={0.24}>
              {proofPoints.map((point) => (
                <Reveal
                  key={point}
                  className="flex items-start gap-2.5 font-mono text-sm leading-6 text-fg"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </Reveal>
              ))}
            </Reveal>
          </div>

          <Reveal direction="left" delay={0.1} className="relative">
            {/* decorative grid-world glyph behind the preview */}
            <GridWorld
              size={7}
              className="pointer-events-none absolute -right-6 -top-10 hidden h-40 w-40 opacity-50 lg:block"
            />
            <HeroPreview />
          </Reveal>
        </div>
      </Section>

      {/* --------------------------- STATS STRIP --------------------------- */}
      <Section className="border-y border-border py-10 md:py-12">
        <Reveal
          group
          className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4"
        >
          {stats.map((s) => (
            <Reveal key={s.label} className="flex flex-col gap-1">
              <span className="font-serif text-3xl text-fg md:text-4xl">
                <CountUp value={s.value} suffix={s.suffix} />
              </span>
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-fg-subtle">
                {s.label}
              </span>
            </Reveal>
          ))}
        </Reveal>
      </Section>

      {/* ---------------------------- SURFACES ----------------------------- */}
      <Section>
        <Reveal>
          <SectionHeader
            kicker="Benchmark surfaces"
            title="Rigorous evaluation, not cherry-picked demo polish."
            lede="Task framing, run uploads, leaderboard slices, and trace inspection move together as one public story."
          />
        </Reveal>
        <Reveal
          group
          className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {surfaces.map((surface) => (
            <Reveal key={surface.title}>
              <SurfaceCard surface={surface} />
            </Reveal>
          ))}
        </Reveal>
      </Section>

      {/* ---------------------------- WORKFLOW ----------------------------- */}
      <Section className="border-t border-border">
        <Reveal>
          <SectionHeader
            kicker="Product workflow"
            title="One workflow: create, evaluate, upload, compare."
            lede="Every stage feeds the next, so a research idea becomes a public, reproducible benchmark without leaving the product."
            action={
              <span
                className="hidden items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle md:inline-flex"
              >
                <Workflow className="h-4 w-4 text-accent" aria-hidden="true" />
                4 stages
              </span>
            }
          />
        </Reveal>
        <WorkflowShowcase />
      </Section>

      {/* ------------------------------ CTA -------------------------------- */}
      <Section className="border-t border-border">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <Reveal>
            <SectionHeader
              as="h2"
              kicker="Live benchmark product"
              title="Publish planning research without the visual clutter."
              lede="Ship new runs, compare them publicly, and reuse the same surface in your README, interviews, portfolio, or research demo."
            />
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/upload" size="lg">
                Open Upload Studio
              </ButtonLink>
              <ButtonLink href="/tasks" variant="secondary" size="lg">
                Explore Benchmark Tasks
              </ButtonLink>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {stack.map((s) => {
                const Icon = s.icon;
                return (
                  <Badge key={s.label} tone="neutral" variant="outline">
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {s.label}
                  </Badge>
                );
              })}
            </div>
          </Reveal>

          <Reveal direction="left" delay={0.1}>
            <Card
              elevation="raised"
              padding="lg"
              className="flex flex-col items-center"
            >
              <p className="self-start font-mono text-[0.7rem] uppercase tracking-[0.18em] text-fg-subtle">
                Imagination rollout
              </p>
              <PlannerTree className="mt-4 h-44 w-full" />
              <p className="mt-4 self-start font-mono text-xs leading-6 text-fg-muted">
                Every ranked run traces back to a planner search over an
                environment model — visible, not hidden behind a screenshot.
              </p>
            </Card>
          </Reveal>
        </div>
      </Section>
    </div>
  );
}
