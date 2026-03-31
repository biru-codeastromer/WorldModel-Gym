"use client";

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
    secondaryLabel: "Upload Existing Run"
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
    secondaryLabel: "Review Task Setup"
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
    secondaryLabel: "CLI & API Guide"
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
    secondaryHref: "/runs/0aadcb16fd8e",
    secondaryLabel: "Inspect Live Run"
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
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active.id === tab.id}
            onClick={() => setActiveId(tab.id)}
            className={`eyebrow-tab ${active.id === tab.id ? "is-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="site-panel paper-matrix rounded-b-[34px] rounded-t-none p-6 md:p-10">
        <div className="rounded-[28px] border border-[var(--line)] bg-[var(--paper-strong)] p-6 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="section-kicker">Workflow {active.label}</p>
              <h3 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {active.title}
              </h3>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
                {active.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
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
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_24px_60px_rgba(38,28,16,0.08)]">
            <div className="h-[280px] rounded-[20px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(250,248,244,0.96),rgba(244,236,226,0.98))]">
              <div className="grid h-full grid-cols-[0.95fr_1.05fr_0.8fr] gap-4 p-5">
                <div className="rounded-[18px] border border-[var(--line)] bg-[var(--paper)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Prompt</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{active.prompt}</p>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-[radial-gradient(circle_at_top,rgba(190,170,145,0.18),transparent_32%),#fffdfa] p-4">
                  <div className="grid h-full grid-cols-2 gap-3">
                    {active.steps.map((step, index) => (
                      <div
                        key={step}
                        className={`rounded-[16px] border border-[var(--line)] p-4 text-sm leading-6 ${
                          index % 2 === 0 ? "bg-[var(--sand)]" : "bg-[var(--paper)]"
                        }`}
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-[var(--paper)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {active.reviewLabel}
                  </p>
                  <div className="mt-3 space-y-3">
                    {active.reviewItems.map((item, index) => (
                      <div
                        key={item}
                        className={`rounded-[14px] border border-[var(--line)] px-3 py-4 text-sm font-medium ${
                          index === 0 ? "bg-[var(--sand)]" : "bg-[var(--paper-strong)]"
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {active.steps.concat(active.reviewItems[0]).slice(0, 5).map((step) => (
              <div
                key={step}
                className="site-soft-panel rounded-[18px] px-4 py-5 text-sm font-medium leading-6 text-[var(--ink)]"
              >
                {step}
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {active.label === "Upload"
              ? "Publish benchmark evidence without leaving the site."
              : "Your benchmark becomes a public product surface instantly."}
          </p>
        </div>
      </div>
    </div>
  );
}
