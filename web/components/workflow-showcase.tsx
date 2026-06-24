"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Boxes,
  Gauge,
  Upload,
  GitCompare,
  type LucideIcon
} from "lucide-react";

import { Reveal, useHoverLift } from "@/components/motion";
import {
  Badge,
  Card,
  Segmented,
  cn,
  type SegmentedOption
} from "@/components/ui";

/**
 * Link styled as a button. The shared Button primitive renders a <button>, so
 * for navigation we mirror its exact token classes on a Next Link / anchor.
 * All colors come from theme tokens, so dark mode + focus rings carry over.
 */
const linkBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-mono font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg h-10 px-5 text-sm";
const linkVariants = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "border border-border-strong bg-surface text-fg hover:bg-surface-2"
} as const;

function ButtonLink({
  href,
  variant = "primary",
  external = false,
  className,
  children
}: {
  href: string;
  variant?: keyof typeof linkVariants;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const classes = cn(linkBase, linkVariants[variant], className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

type WorkflowId = "create" | "evaluate" | "upload" | "compare";

type WorkflowTab = {
  id: WorkflowId;
  label: string;
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
  prompt: string;
  checklist: string[];
  steps: { title: string; detail: string }[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
};

const tabs: WorkflowTab[] = [
  {
    id: "create",
    label: "Create",
    step: "01",
    icon: Boxes,
    title: "Design a benchmark brief that reads clearly from the first click.",
    description:
      "Shape sparse-reward tasks, defaults, and success criteria before you ever touch a leaderboard. The fastest path from a research idea to a benchmark someone else can immediately understand.",
    prompt:
      "Frame a partially observable benchmark with delayed reward, reproducible seeds, and a planning budget that matches the story you want the leaderboard to tell.",
    checklist: ["Task defaults", "Observation mode", "Reward design"],
    steps: [
      { title: "Pick an environment", detail: "Choose a task with explicit constraints and failure modes." },
      { title: "Lock the defaults", detail: "Set seeds and budgets that make the benchmark reproducible." },
      { title: "Carry it forward", detail: "Move the task straight into evaluation and upload." }
    ],
    primaryHref: "/tasks",
    primaryLabel: "Browse Tasks",
    secondaryHref: "/upload",
    secondaryLabel: "Upload Existing Run"
  },
  {
    id: "evaluate",
    label: "Evaluate",
    step: "02",
    icon: Gauge,
    title: "Run agents against real tracks and inspect the signal cleanly.",
    description:
      "Evaluation is where the benchmark earns trust. Use live tracks, keep planning cost visible, and move into run-level inspection without falling back to notebooks or screenshots.",
    prompt:
      "Evaluate the same task across multiple agents, keep planning cost visible, and surface enough run detail for collaborators to verify the result without digging through raw logs.",
    checklist: ["Track selection", "Planning cost", "Run detail"],
    steps: [
      { title: "Choose a track", detail: "Inspect the current leaderboard for test, train, or continual." },
      { title: "Open run pages", detail: "Review metrics and traces behind every ranked row." },
      { title: "Compare profiles", detail: "Weigh cost against outcome side by side." }
    ],
    primaryHref: "/leaderboard",
    primaryLabel: "Open Leaderboard",
    secondaryHref: "/tasks",
    secondaryLabel: "Review Task Setup"
  },
  {
    id: "upload",
    label: "Upload",
    step: "03",
    icon: Upload,
    title: "Publish a run through the browser, or keep the API and CLI.",
    description:
      "The upload flow should not be hidden behind shell commands. Use the web form for run creation and artifact upload, then keep the API and CLI snippets for automation and lab workflows.",
    prompt:
      "Create a run record, attach metrics, trace, and config artifacts, and publish the result to the live leaderboard without leaving the product surface.",
    checklist: ["API key", "Artifact bundle", "Published run"],
    steps: [
      { title: "Enter metadata", detail: "Add run details and your writer key." },
      { title: "Attach artifacts", detail: "Upload metrics, trace, and config files." },
      { title: "Publish", detail: "Jump straight to the live run page." }
    ],
    primaryHref: "/upload",
    primaryLabel: "Open Upload Studio",
    secondaryHref: "https://github.com/biru-codeastromer/WorldModel-Gym/blob/main/docs/OPERATIONS.md",
    secondaryLabel: "CLI & API Guide"
  },
  {
    id: "compare",
    label: "Compare",
    step: "04",
    icon: GitCompare,
    title: "Turn benchmark results into something that reads like a product page.",
    description:
      "The leaderboard is more than a table. It is where success rate, return, and planning cost become a public story you can share in a portfolio, demo, or research conversation.",
    prompt:
      "Compare tracks, highlight fast versus strong policies, and inspect the exact run behind every leaderboard row.",
    checklist: ["Track filters", "Run rankings", "Shareable pages"],
    steps: [
      { title: "Switch tracks", detail: "Move between test, train, and continual." },
      { title: "Read the top runs", detail: "Inspect leaders and their cost profiles." },
      { title: "Open any row", detail: "Jump to the run detail page behind it." }
    ],
    primaryHref: "/leaderboard",
    primaryLabel: "Compare Tracks",
    secondaryHref: "/upload?track=continual",
    secondaryLabel: "Upload Comparison Run"
  }
];

const options: SegmentedOption<WorkflowId>[] = tabs.map((t) => ({
  value: t.id,
  label: t.label
}));

export function WorkflowShowcase() {
  const [activeId, setActiveId] = useState<WorkflowId>("create");
  const active = useMemo(
    () => tabs.find((tab) => tab.id === activeId) ?? tabs[0],
    [activeId]
  );
  const lift = useHoverLift();
  const ActiveIcon = active.icon;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Segmented
          options={options}
          value={activeId}
          onChange={setActiveId}
          ariaLabel="Workflow stage"
        />
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">
          Stage {active.step} / 04
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          key={`copy-${active.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-2 text-accent">
              <ActiveIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <Badge tone="accent" variant="outline">
              Workflow {active.label}
            </Badge>
          </div>

          <h3 className="mt-6 max-w-xl font-serif text-2xl leading-[1.15] tracking-[-0.01em] text-fg md:text-3xl">
            {active.title}
          </h3>
          <p className="mt-4 max-w-xl font-mono text-sm leading-7 text-fg-muted">
            {active.description}
          </p>

          <Card inset padding="md" className="mt-6 max-w-xl">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-fg-subtle">
              Prompt
            </p>
            <p className="mt-2 font-serif text-lg leading-[1.4] text-fg">
              {active.prompt}
            </p>
          </Card>

          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href={active.primaryHref}>
              {active.primaryLabel}
            </ButtonLink>
            <ButtonLink
              href={active.secondaryHref}
              variant="secondary"
              external={active.secondaryHref.startsWith("http")}
            >
              {active.secondaryLabel}
            </ButtonLink>
          </div>
        </motion.div>

        <motion.div
          key={`detail-${active.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <Reveal group className="grid gap-3">
            {active.steps.map((s, index) => (
              <Reveal key={s.title}>
                <motion.div {...lift}>
                  <Card
                    elevation="raised"
                    padding="md"
                    className="flex items-start gap-4"
                  >
                    <span
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-sm font-semibold text-accent"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-mono text-sm font-medium text-fg">
                        {s.title}
                      </p>
                      <p className="mt-1 font-mono text-xs leading-6 text-fg-muted">
                        {s.detail}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              </Reveal>
            ))}
          </Reveal>

          <div className="mt-4 flex flex-wrap gap-2">
            {active.checklist.map((item) => (
              <Badge key={item} tone="neutral" variant="soft">
                {item}
              </Badge>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

