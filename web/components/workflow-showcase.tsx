"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type WorkflowTab = {
  id: string;
  label: string;
  title: string;
  description: string;
  prompt: string;
  reviewLabel: string;
  reviewItems: string[];
  steps: string[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  imageSrc: string;
  imageAlt: string;
};

const tabs: WorkflowTab[] = [
  {
    id: "create",
    label: "Create",
    title: "Design a benchmark brief that feels intentional from the first click.",
    description:
      "Shape sparse-reward tasks, defaults, and success criteria before you ever touch a leaderboard. This is the fastest way to move from a research idea to a benchmark someone else can immediately understand.",
    prompt:
      "Frame a partially observable benchmark with delayed reward, reproducible seeds, and a planning budget that matches the story you want the leaderboard to tell.",
    reviewLabel: "Task framing",
    reviewItems: ["Task defaults", "Observation mode", "Reward design"],
    steps: [
      "Choose an environment with explicit constraints",
      "Set defaults that make the benchmark reproducible",
      "Carry the task into evaluation and upload flows"
    ],
    primaryHref: "/tasks",
    primaryLabel: "Browse Tasks",
    secondaryHref: "/upload",
    secondaryLabel: "Upload Existing Run",
    imageSrc: "/editorial/hero-goumbik.jpg",
    imageAlt: "Desk with chart and notebook"
  },
  {
    id: "evaluate",
    label: "Evaluate",
    title: "Run agents against real benchmark tracks and inspect the signal cleanly.",
    description:
      "Evaluation is where the benchmark earns trust. Use live tracks, compare planning cost, and move into run-level inspection without falling back to notebooks or screenshots.",
    prompt:
      "Evaluate the same task across multiple agents, keep planning cost visible, and surface enough run detail for collaborators to verify the result without digging through raw logs.",
    reviewLabel: "Evaluation",
    reviewItems: ["Track selection", "Planning cost", "Run detail links"],
    steps: [
      "Choose a track and inspect the current leaderboard",
      "Open run pages to review metrics and traces",
      "Compare cost and outcome side by side"
    ],
    primaryHref: "/leaderboard",
    primaryLabel: "Open Leaderboard",
    secondaryHref: "/tasks",
    secondaryLabel: "Review Task Setup",
    imageSrc: "/editorial/market-pixabay.jpg",
    imageAlt: "Stock board with market metrics"
  },
  {
    id: "upload",
    label: "Upload",
    title: "Push a run through the browser, or keep using the API and CLI if you prefer.",
    description:
      "The upload flow should not be hidden behind shell commands. Use the new web form for run creation and artifact upload, then keep the API and CLI snippets for automation and lab workflows.",
    prompt:
      "Create a run record, attach metrics, trace, and config artifacts, and publish the result to the live leaderboard without leaving the product surface.",
    reviewLabel: "Upload review",
    reviewItems: ["API key", "Artifact bundle", "Published run"],
    steps: [
      "Enter run metadata and your writer key",
      "Attach metrics, trace, and config files",
      "Publish and jump straight to the run page"
    ],
    primaryHref: "/upload",
    primaryLabel: "Open Upload Studio",
    secondaryHref: "https://github.com/biru-codeastromer/WorldModel-Gym/blob/main/docs/OPERATIONS.md",
    secondaryLabel: "CLI & API Guide",
    imageSrc: "/editorial/team-thirdman.jpg",
    imageAlt: "Team reviewing charts and analytics"
  },
  {
    id: "compare",
    label: "Compare",
    title: "Turn benchmark results into something that reads like a shipped product page.",
    description:
      "The leaderboard is more than a table. It is where success rate, return, and planning cost become a public story you can share in a portfolio, demo, or research conversation.",
    prompt:
      "Compare tracks, highlight fast versus strong policies, and inspect the exact run behind every leaderboard row.",
    reviewLabel: "Comparison",
    reviewItems: ["Track filters", "Run rankings", "Shareable run pages"],
    steps: [
      "Switch between test, train, and continual",
      "Inspect the top runs and their cost profiles",
      "Open the run detail page behind any row"
    ],
    primaryHref: "/leaderboard",
    primaryLabel: "Compare Tracks",
    secondaryHref: "/upload?track=continual",
    secondaryLabel: "Upload Comparison Run",
    imageSrc: "/editorial/chart-rdne.jpg",
    imageAlt: "Research chart in soft pink tones"
  }
];

export function WorkflowShowcase() {
  const [activeId, setActiveId] = useState("create");
  const active = useMemo(
    () => tabs.find((tab) => tab.id === activeId) ?? tabs[0],
    [activeId]
  );

  return (
    <div>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active.id === tab.id}
            onClick={() => setActiveId(tab.id)}
            className={`eyebrow-tab text-left ${active.id === tab.id ? "is-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-10 border-t border-[rgba(185,174,195,0.46)] pt-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <p className="section-kicker">Workflow {active.label}</p>
          <h3 className="mt-6 max-w-2xl font-[var(--font-serif)] text-5xl font-medium leading-[0.96] text-[var(--ink)] md:text-6xl">
            {active.title}
          </h3>
          <p className="mt-5 max-w-xl text-base leading-8 text-[var(--muted)]">{active.description}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={active.primaryHref} className="button-primary px-5 py-3 text-sm font-semibold">
              {active.primaryLabel}
            </Link>
            {active.secondaryHref.startsWith("http") ? (
              <a
                href={active.secondaryHref}
                target="_blank"
                rel="noreferrer"
                className="button-secondary px-5 py-3 text-sm font-semibold"
              >
                {active.secondaryLabel}
              </a>
            ) : (
              <Link href={active.secondaryHref} className="button-secondary px-5 py-3 text-sm font-semibold">
                {active.secondaryLabel}
              </Link>
            )}
          </div>

          <div className="mt-10 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Prompt</p>
              <p className="mt-3 max-w-xl font-[var(--font-serif)] text-2xl leading-[1.2] text-[rgba(29,26,36,0.88)]">
                {active.prompt}
              </p>
            </div>
            <div className="grid gap-4 border-t border-[rgba(185,174,195,0.42)] pt-5 md:grid-cols-3">
              {active.steps.map((step, index) => (
                <div key={step} className="px-1 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Step {index + 1}</p>
                  <p className="mt-3 max-w-[18rem] text-sm leading-7 text-[var(--ink)]">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="relative aspect-[1.04/1] overflow-hidden rounded-[28px]">
              <Image
                src={active.imageSrc}
                alt={active.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 34vw"
              />
            </div>
            <div className="border-t border-[rgba(185,174,195,0.42)] pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{active.reviewLabel}</p>
              <div className="mt-5 space-y-4">
                {active.reviewItems.map((item) => (
                  <p key={item} className="border-b border-[rgba(185,174,195,0.3)] pb-4 text-sm leading-7 text-[var(--ink)] last:border-b-0 last:pb-0">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-[rgba(185,174,195,0.42)] pt-5 sm:grid-cols-3">
            {active.reviewItems.map((item) => (
              <div key={item} className="text-sm leading-7 text-[var(--ink)]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
