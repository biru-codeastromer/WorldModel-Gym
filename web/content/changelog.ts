/**
 * Release-notes registry for WorldModel Gym.
 *
 * Hand-authored from the project's real evolution (repo CHANGELOG.md plus the
 * git history themes: production hardening, scientific-honesty metric fixes,
 * scalability/queue tier, testing + supply-chain, API contract features, and
 * the UI overhaul with its iconic features). It is fully self-contained inside
 * web/ — nothing here is read from repo-root files at build or runtime, since
 * Vercel only deploys web/.
 *
 * Entries are kept high-level and tasteful: they describe the shape of each
 * release rather than inventing precise version numbers or dates beyond what is
 * already public. Changes are grouped by a small, tone-coded vocabulary so the
 * page can color-code them consistently.
 */

export type ChangeKind = "Added" | "Changed" | "Fixed" | "Security";

export type ChangeGroup = {
  kind: ChangeKind;
  items: string[];
};

export type ReleaseEntry = {
  /** Semantic-ish version label, e.g. "0.5.0" or "Unreleased". */
  version: string;
  /** Human date label, e.g. "2026-06". Empty for the unreleased line. */
  date: string;
  /** Short editorial title for the release theme. */
  title: string;
  /** One-line summary of what the release is about. */
  summary: string;
  /** Optional emphasis flag for the most recent / headline release. */
  highlight?: boolean;
  /** Grouped, tone-coded changes. */
  groups: ChangeGroup[];
};

/** Tone mapping for each change kind, consumed by the timeline Badges. */
export const CHANGE_TONE = {
  Added: "success",
  Changed: "accent",
  Fixed: "neutral",
  Security: "warning"
} as const;

/**
 * Releases, newest first. The first non-unreleased entry is treated as the
 * headline release on the page.
 */
export const RELEASES: ReleaseEntry[] = [
  {
    version: "Unreleased",
    date: "",
    title: "On the bench",
    summary:
      "Pending release metadata and follow-up benchmark extensions in active development.",
    groups: [
      {
        kind: "Added",
        items: [
          "Release-notes and About pages, wired into the footer and sitemap.",
          "Continued work on benchmark coverage and additional planner baselines."
        ]
      }
    ]
  },
  {
    version: "0.6.0",
    date: "2026-06",
    title: "Editorial UI overhaul & iconic features",
    summary:
      "A full front-end redesign around an editorial design system, plus the marquee features that make the dashboard feel like a product.",
    highlight: true,
    groups: [
      {
        kind: "Added",
        items: [
          "A cohesive design system: tokens in globals.css, Tailwind class-based dark mode, and reusable UI primitives (Button, Card, Badge, Stat, Section).",
          "Command palette (⌘K) for keyboard-first navigation across tasks, leaderboard, and docs.",
          "Run comparison view and an interactive episode-trace player for inspecting agent behavior.",
          "Generated Open Graph / Twitter images, a keyboard-shortcuts dialog, and an in-app docs site.",
          "Scroll-reveal motion, sparklines, and on-brand environment glyphs, all theme-aware."
        ]
      },
      {
        kind: "Changed",
        items: [
          "Reworked navigation and page layouts into a calmer, editorial information hierarchy.",
          "Adopted a serif display + mono body type pairing and reduced decorative box framing."
        ]
      },
      {
        kind: "Fixed",
        items: [
          "Tightened route coverage and resolved site interaction and spacing inconsistencies.",
          "Aligned end-to-end smoke tests with the redesigned UI."
        ]
      }
    ]
  },
  {
    version: "0.5.0",
    date: "2026-05",
    title: "API contract, pagination & tracing",
    summary:
      "Production-grade API surface: stable contracts, cursor pagination, and end-to-end observability.",
    groups: [
      {
        kind: "Added",
        items: [
          "OpenTelemetry tracing across the request lifecycle for distributed debugging.",
          "Cursor-based pagination on list endpoints for stable, scalable result paging.",
          "ESLint and stricter typing on the web client for a consistent contract surface."
        ]
      },
      {
        kind: "Changed",
        items: [
          "Normalized proxied API paths so the browser client and server share one base.",
          "Hardened the API client with zod-validated request and response schemas."
        ]
      }
    ]
  },
  {
    version: "0.4.0",
    date: "2026-04",
    title: "Testing & supply-chain hardening",
    summary:
      "Confidence in every release: automated tests, CI/CD, and a locked-down dependency supply chain.",
    groups: [
      {
        kind: "Added",
        items: [
          "Unit and end-to-end test suites with Playwright smoke coverage in CI.",
          "Continuous integration pipeline gating lint, type-check, tests, and build.",
          "Pre-commit tooling and reproducible dependency pinning."
        ]
      },
      {
        kind: "Security",
        items: [
          "Supply-chain hardening: pinned and audited dependencies to reduce drift and exposure."
        ]
      },
      {
        kind: "Fixed",
        items: [
          "Stabilized flaky Playwright startup and Python fallback paths in CI."
        ]
      }
    ]
  },
  {
    version: "0.3.0",
    date: "2026-03",
    title: "Scalability: stateless API & async jobs",
    summary:
      "Built to scale horizontally — a stateless API tier and an asynchronous job queue for heavy evaluations.",
    groups: [
      {
        kind: "Added",
        items: [
          "Asynchronous job tier so long-running evaluations no longer block the request path.",
          "Per-run budget controls and a sliding-window rate limiter to protect shared capacity."
        ]
      },
      {
        kind: "Changed",
        items: [
          "Made the API stateless so instances can scale out behind a load balancer.",
          "Moved durable run and artifact state out of process memory into shared storage."
        ]
      }
    ]
  },
  {
    version: "0.2.0",
    date: "2026-03",
    title: "Reliability, data integrity & honest metrics",
    summary:
      "Production defaults plus a scientific-honesty pass that made the leaderboard trustworthy.",
    groups: [
      {
        kind: "Changed",
        items: [
          "Corrected benchmark metric definitions so the leaderboard reflects honest, reproducible scores.",
          "Switched to durable storage with data-integrity guarantees for runs and artifacts.",
          "Promoted production-ready defaults across the server and deployment configuration."
        ]
      },
      {
        kind: "Security",
        items: [
          "Introduced secure API-key authentication with bootstrap key creation on startup.",
          "Added rate limiting to guard submission and query endpoints."
        ]
      },
      {
        kind: "Fixed",
        items: [
          "Repaired world-model training gradients and removed demo rows from the public leaderboard.",
          "Cleaned backend startup and database migration paths for reliable deploys."
        ]
      }
    ]
  },
  {
    version: "0.1.0",
    date: "2026-02-21",
    title: "Initial benchmark platform",
    summary:
      "The first public cut: environments, evaluation harness, submission API, and dashboards.",
    groups: [
      {
        kind: "Added",
        items: [
          "Monorepo scaffold spanning core, agents, planners, world models, and the server.",
          "Three procedural long-horizon environments: MemoryMaze, SwitchQuest, and CraftLite.",
          "A deterministic evaluation harness, stable episode-trace schema, CLI runner, and continual-track metrics.",
          "Planner baselines (MCTS, MPC-CEM, trajectory sampling) and world-model baselines (deterministic, stochastic, ensemble).",
          "A FastAPI submission service with runs CRUD, artifact uploads, leaderboard queries, and trace downloads.",
          "A Next.js dashboard (home, tasks, leaderboard, run viewer) and an Expo mobile viewer.",
          "Docker Compose stack, demo upload script, CI workflow, and the paper artifacts."
        ]
      }
    ]
  }
];
