import Image from "next/image";
import Link from "next/link";

import { WorkflowShowcase } from "@/components/workflow-showcase";

const proofPoints = [
  "Sparse-reward environments with reproducible seeds",
  "Public leaderboard slices across test, train, and continual tracks",
  "Browser upload flow alongside API and CLI submission paths"
];

const surfaces = [
  {
    title: "Task library",
    description: "Document environments the way a strong research deck would: clear defaults, precise constraints, and readable benchmark framing.",
    href: "/tasks",
    cta: "Browse tasks"
  },
  {
    title: "Live leaderboards",
    description: "Compare planning quality, return, and cost in one public surface instead of across notebooks, screenshots, and scattered artifacts.",
    href: "/leaderboard",
    cta: "Open leaderboards"
  },
  {
    title: "Upload studio",
    description: "Create a run, attach metrics and traces, and publish it from the browser while keeping automation-friendly CLI and API options.",
    href: "/upload",
    cta: "Publish a run"
  }
];

const capabilities = [
  "Design benchmark tasks with explicit failure modes",
  "Upload metrics, traces, and configs without leaving the product surface",
  "Inspect runs, compare tracks, and share outcomes with one clean URL"
];

export default function HomePage() {
  return (
    <section className="space-y-20 pb-8">
      <section className="border-b border-[rgba(185,174,195,0.46)] pb-16 pt-8">
        <div className="grid items-start gap-14 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="max-w-xl">
            <p className="section-kicker">Research benchmark platform</p>
            <h1 className="mt-8 font-[var(--font-serif)] text-6xl font-medium leading-[0.92] tracking-[-0.04em] text-[var(--ink)] md:text-7xl">
              Benchmark agents with the calm precision of an editorial research studio.
            </h1>
            <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
              WorldModel Gym turns environments, uploads, traces, and leaderboards into a public-facing benchmark
              product that feels intentional from the first click.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/upload" className="button-primary px-6 py-3 text-sm font-semibold">
                Get Started
              </Link>
              <Link href="/leaderboard" className="button-secondary px-6 py-3 text-sm font-semibold">
                View Leaderboard
              </Link>
            </div>
            <div className="mt-10 space-y-4">
              {proofPoints.map((point) => (
                <div key={point} className="flex items-start gap-3 text-sm leading-7 text-[var(--ink)]">
                  <span className="mt-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="relative aspect-[0.95/1.08] overflow-hidden rounded-[30px]">
              <Image
                src="/editorial/hero-goumbik.jpg"
                alt="Desk with benchmark notes and chart printouts"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
              />
            </div>
            <div className="flex flex-col justify-between gap-8 pt-2">
              <div className="max-w-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Benchmark narrative
                </p>
                <p className="mt-5 font-[var(--font-serif)] text-4xl leading-[1.02] text-[var(--ink)]">
                  Build a benchmark surface that communicates as well as the experiment itself.
                </p>
              </div>
              <div className="relative aspect-[1/0.92] overflow-hidden rounded-[28px]">
                <Image
                  src="/editorial/chart-rdne.jpg"
                  alt="Close-up market research chart"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 24vw"
                />
              </div>
            </div>
            <div className="lg:col-span-2 mt-1 flex flex-wrap gap-6 border-t border-[rgba(185,174,195,0.4)] pt-4">
              <span className="stat-chip">FastAPI + Postgres + S3</span>
              <span className="stat-chip">Next.js App Router</span>
              <span className="stat-chip">Real runs live in production</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-12 border-b border-[rgba(185,174,195,0.46)] pb-16 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="max-w-lg">
          <p className="section-kicker">Our benchmark surfaces</p>
          <h2 className="mt-7 font-[var(--font-serif)] text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-[var(--ink)] md:text-6xl">
            Rigorous evaluation, not cherry-picked demo polish.
          </h2>
          <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
            The site is designed to make benchmark evidence readable: task framing, run uploads, leaderboard slices,
            and trace inspection all move together as one public story.
          </p>
          <div className="mt-8 space-y-4">
            {capabilities.map((capability) => (
              <div key={capability} className="border-b border-[rgba(185,174,195,0.42)] pb-4 text-base leading-7 text-[var(--ink)]">
                {capability}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative aspect-[1.1/0.95] overflow-hidden rounded-[28px]">
            <Image
              src="/editorial/team-thirdman.jpg"
              alt="Team working over charts and data"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 38vw"
            />
          </div>
          <div className="space-y-8">
            {surfaces.map((surface) => (
              <article key={surface.title} className="border-b border-[rgba(185,174,195,0.42)] pb-6">
                <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">{surface.title}</p>
                <p className="mt-4 font-[var(--font-serif)] text-3xl leading-[1.08] text-[var(--ink)]">
                  {surface.description}
                </p>
                <Link href={surface.href} className="editorial-link mt-4 inline-block text-sm font-semibold">
                  {surface.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[rgba(185,174,195,0.46)] pb-16">
        <div className="max-w-3xl">
          <p className="section-kicker">Product workflow</p>
          <h2 className="mt-7 font-[var(--font-serif)] text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-[var(--ink)] md:text-6xl">
            A single workflow for create, evaluate, upload, and compare.
          </h2>
        </div>
        <WorkflowShowcase />
      </section>

      <section className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="section-kicker">Live benchmark product</p>
          <h2 className="mt-7 max-w-2xl font-[var(--font-serif)] text-5xl font-medium leading-[0.98] tracking-[-0.04em] text-[var(--ink)] md:text-6xl">
            Ready to publish planning research without the visual clutter.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
            Ship new runs, compare them publicly, and use the same benchmark surface in your README, interviews,
            project portfolio, or research demo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/upload" className="button-primary px-6 py-3 text-sm font-semibold">
              Open Upload Studio
            </Link>
            <Link href="/tasks" className="button-secondary px-6 py-3 text-sm font-semibold">
              Explore Benchmark Tasks
            </Link>
          </div>
        </div>

        <div className="relative aspect-[1.15/0.96] overflow-hidden rounded-[30px]">
          <Image
            src="/editorial/market-pixabay.jpg"
            alt="Financial board visual suggesting live benchmark comparison"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 44vw"
          />
        </div>
      </section>
    </section>
  );
}
