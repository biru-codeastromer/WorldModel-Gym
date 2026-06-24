import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  GitBranch,
  Layers,
  Microscope,
  Repeat,
  Server,
  Sigma,
  Target,
  Telescope
} from "lucide-react";

import { CiteBlock } from "@/components/cite";
import { Reveal } from "@/components/motion";
import {
  Badge,
  Card,
  Section,
  SectionHeader,
  Stat,
  cn
} from "@/components/ui";
import { GridWorld, PlannerTree } from "@/components/visuals";

export const metadata: Metadata = {
  title: "About",
  description:
    "WorldModel Gym is a reproducible research benchmark for long-horizon planning under sparse rewards and partial observability — honest metrics, seeded tracks, and credible baselines. Cite the benchmark.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About WorldModel Gym",
    description:
      "A reproducible benchmark for long-horizon planning under sparse rewards and partial observability — methodology, architecture, and how to cite.",
    url: "/about",
    type: "website"
  }
};

/* ------------------------------- page content ------------------------------ */

const motivations = [
  {
    icon: Telescope,
    title: "Long-horizon planning",
    body: "Goals sit dozens of dependent steps away. An agent must look ahead through a learned model of the world, not react one frame at a time."
  },
  {
    icon: Target,
    title: "Sparse rewards",
    body: "Reward arrives only at a terminal goal event. There is no dense shaping to climb, so credit assignment has to survive long stretches of silence."
  },
  {
    icon: Boxes,
    title: "Partial observability",
    body: "A limited field of view hides most of the state. The agent has to remember, infer, and imagine what it cannot currently see."
  }
];

const methodology = [
  {
    icon: Repeat,
    kicker: "Reproducible tracks",
    title: "Seeded test, train, and continual",
    body: "Every environment ships fixed seeds across three tracks. Test seeds are held out from training; the continual track replays a shifting task stream so non-stationary adaptation is measured, not assumed.",
    points: [
      "Deterministic episode generation from a track seed",
      "Held-out test seeds, disjoint from train",
      "Continual track for drift and forgetting"
    ]
  },
  {
    icon: Sigma,
    kicker: "Honest metrics",
    title: "Success from terminal goal events",
    body: "Success counts only true terminal goal events from the trace — no proxy heuristics. Aggregate numbers carry bootstrap confidence intervals, and model quality is reported as true k-step fidelity, not a single-step proxy.",
    points: [
      "Success = terminal goal event in the episode trace",
      "Bootstrap CIs on every aggregate metric",
      "True k-step world-model fidelity, not 1-step"
    ]
  },
  {
    icon: Microscope,
    kicker: "Credible baselines",
    title: "From BFS oracle to real PPO",
    body: "Each track is anchored by reference agents spanning the difficulty spectrum, so a new submission is read against a meaningful floor and ceiling rather than a single cherry-picked number.",
    points: [
      "BFS oracle — shortest-path upper bound",
      "Value-bootstrapped MCTS and MPC-CEM planners",
      "A real PPO learner, not a placeholder"
    ]
  }
];

const baselines = [
  {
    name: "BFS oracle",
    tone: "success" as const,
    role: "Upper bound",
    note: "Breadth-first shortest path on the true state — the practical ceiling for each seed."
  },
  {
    name: "MCTS (value-bootstrapped)",
    tone: "accent" as const,
    role: "Search planner",
    note: "Tree search over the learned model, bootstrapped from a learned value estimate."
  },
  {
    name: "MPC-CEM",
    tone: "accent" as const,
    role: "Imagination planner",
    note: "Cross-entropy method rolling out action sequences inside the world model."
  },
  {
    name: "PPO",
    tone: "warning" as const,
    role: "Model-free learner",
    note: "A genuine on-policy RL baseline — the honest model-free reference point."
  }
];

const architecture = [
  {
    icon: Boxes,
    label: "Environments",
    body: "MemoryMaze, SwitchQuest, and CraftLite — procedural, sparse-reward, partially observed."
  },
  {
    icon: GitBranch,
    label: "Planners + world models",
    body: "MCTS, MPC-CEM, and trajectory sampling over deterministic, stochastic, and ensemble latents."
  },
  {
    icon: Server,
    label: "Evaluation server",
    body: "FastAPI runs CRUD, artifact uploads, leaderboard queries, and trace/metrics downloads."
  },
  {
    icon: Layers,
    label: "Dashboard",
    body: "This Next.js App Router surface — tasks, leaderboards, run viewer, and compare."
  }
];

const trackStats = [
  { label: "Environments", value: "3", unit: "" },
  { label: "Evaluation tracks", value: "3", unit: "" },
  { label: "Reference baselines", value: "6", unit: "+" },
  { label: "Reward signal", value: "Sparse", unit: "" }
];

function MotivationCard({ item }: { item: (typeof motivations)[number] }) {
  const Icon = item.icon;
  return (
    <Card elevation="raised" padding="lg" className="flex h-full flex-col">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface-2 text-accent">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-5 font-serif text-xl text-fg">{item.title}</h3>
      <p className="mt-2 flex-1 font-mono text-sm leading-7 text-fg-muted">
        {item.body}
      </p>
    </Card>
  );
}

export default function AboutPage() {
  return (
    <div className="pb-10">
      {/* -------------------------------- HERO -------------------------------- */}
      <Section className="pt-2 md:pt-4">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="max-w-xl">
            <Reveal>
              <Badge tone="accent" variant="outline">
                Research benchmark
              </Badge>
            </Reveal>
            <h1 className="mt-5 font-serif text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-fg sm:text-5xl">
              A credible benchmark for agents that have to plan.
            </h1>
            <Reveal direction="up" delay={0.12}>
              <p className="mt-5 font-mono text-base leading-7 text-fg-muted">
                WorldModel Gym measures long-horizon planning under sparse rewards
                and partial observability — the regime where reactive policies
                stall and a learned model of the world starts to matter. It is
                built to be reproducible, honestly measured, and read at a glance.
              </p>
            </Reveal>
            <Reveal direction="up" delay={0.18}>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/docs"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 font-mono text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  Read the docs
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/leaderboard"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-6 font-mono text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  See the leaderboard
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal direction="left" delay={0.1} className="relative">
            <GridWorld
              size={7}
              className="pointer-events-none absolute -right-6 -top-12 hidden h-40 w-40 opacity-40 lg:block"
            />
            <Card elevation="pop" padding="lg" className="flex flex-col">
              <p className="self-start font-mono text-[0.7rem] uppercase tracking-[0.18em] text-fg-subtle">
                Plan over a learned model
              </p>
              <PlannerTree className="mt-4 h-44 w-full" />
              <p className="mt-4 font-mono text-xs leading-6 text-fg-muted">
                An agent imagines rollouts through a world model, then commits to
                the path most likely to reach a goal it usually cannot see.
              </p>
            </Card>
          </Reveal>
        </div>
      </Section>

      {/* ----------------------------- STATS STRIP ---------------------------- */}
      <Section className="border-y border-border py-10 md:py-12">
        <Reveal
          group
          className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4"
        >
          {trackStats.map((s) => (
            <Reveal key={s.label}>
              <Stat label={s.label} value={s.value} unit={s.unit} />
            </Reveal>
          ))}
        </Reveal>
      </Section>

      {/* ------------------------------- WHY ---------------------------------- */}
      <Section>
        <Reveal>
          <SectionHeader
            kicker="Why this benchmark"
            title="The hard part is what you cannot see."
            lede="Most benchmarks reward fast reactions. WorldModel Gym isolates the three pressures that force an agent to actually model the world."
          />
        </Reveal>
        <Reveal group className="mt-10 grid gap-6 md:grid-cols-3">
          {motivations.map((item) => (
            <Reveal key={item.title}>
              <MotivationCard item={item} />
            </Reveal>
          ))}
        </Reveal>
      </Section>

      {/* --------------------------- METHODOLOGY ------------------------------ */}
      <Section className="border-t border-border">
        <Reveal>
          <SectionHeader
            kicker="Scientific methodology"
            title="Reproducible by construction, honestly measured."
            lede="A benchmark is only as credible as its bookkeeping. Three commitments keep the numbers trustworthy."
          />
        </Reveal>
        <div className="mt-10 flex flex-col gap-6">
          {methodology.map((m) => {
            const Icon = m.icon;
            return (
              <Reveal key={m.title}>
                <Card
                  elevation="raised"
                  padding="lg"
                  className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-start"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-2 text-accent">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-accent">
                        {m.kicker}
                      </p>
                    </div>
                    <h3 className="mt-4 font-serif text-2xl text-fg">
                      {m.title}
                    </h3>
                    <p className="mt-3 font-mono text-sm leading-7 text-fg-muted">
                      {m.body}
                    </p>
                  </div>
                  <ul className="flex flex-col gap-3 md:pt-1">
                    {m.points.map((p) => (
                      <li
                        key={p}
                        className="flex items-start gap-2.5 font-mono text-sm leading-6 text-fg"
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                          aria-hidden="true"
                        />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* ----------------------------- BASELINES ------------------------------ */}
      <Section className="border-t border-border">
        <Reveal>
          <SectionHeader
            kicker="Reference baselines"
            title="A meaningful floor and ceiling."
            lede="Every track is anchored from a shortest-path oracle down to a real model-free learner, so a new run is read against context — not in a vacuum."
          />
        </Reveal>
        <Reveal group className="mt-10 grid gap-4 sm:grid-cols-2">
          {baselines.map((b) => (
            <Reveal key={b.name}>
              <Card
                elevation="flat"
                padding="md"
                className="flex h-full flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-medium text-fg">
                    {b.name}
                  </span>
                  <Badge tone={b.tone} variant="soft">
                    {b.role}
                  </Badge>
                </div>
                <p className="font-mono text-xs leading-6 text-fg-muted">
                  {b.note}
                </p>
              </Card>
            </Reveal>
          ))}
        </Reveal>
      </Section>

      {/* --------------------------- ARCHITECTURE ----------------------------- */}
      <Section className="border-t border-border">
        <Reveal>
          <SectionHeader
            kicker="Architecture at a glance"
            title="One pipeline, from environment to public run."
            lede="A Python research core feeds an evaluation server; this dashboard renders the result as a benchmark you can share with a URL."
          />
        </Reveal>
        <Reveal group className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {architecture.map((a) => {
            const Icon = a.icon;
            return (
              <Reveal key={a.label}>
                <Card
                  elevation="flat"
                  padding="lg"
                  className="flex h-full flex-col"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-2 text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-mono text-sm font-medium text-fg">
                    {a.label}
                  </h3>
                  <p className="mt-2 flex-1 font-mono text-xs leading-6 text-fg-muted">
                    {a.body}
                  </p>
                </Card>
              </Reveal>
            );
          })}
        </Reveal>
      </Section>

      {/* ------------------------------- CITE --------------------------------- */}
      <Section className="border-t border-border">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-14">
          <Reveal>
            <SectionHeader
              kicker="Get involved"
              title="Use it, extend it, cite it."
              lede="Submit a run from the browser, the API, or the CLI. If WorldModel Gym helps your work, a citation keeps the benchmark honest and traceable."
            />
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/upload"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 font-mono text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Publish a run
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/docs"
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-6 font-mono text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                )}
              >
                Submission guide
              </Link>
            </div>
          </Reveal>

          <Reveal direction="left" delay={0.08}>
            <CiteBlock />
          </Reveal>
        </div>
      </Section>
    </div>
  );
}
