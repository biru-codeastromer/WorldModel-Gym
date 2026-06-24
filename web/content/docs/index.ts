/**
 * Docs content registry.
 *
 * Hand-curated from the WorldModel Gym codebase and repo docs, but fully
 * self-contained inside web/ — nothing here is read from repo-root files at
 * build or runtime (Vercel only deploys web/). Every API path, header, CLI
 * command, env name, track, environment, and metric below mirrors the actual
 * server (server/worldmodel_server/main.py, schemas.py, cli.py) and the web
 * client (lib/api.ts).
 */

import type { AnchorItem, DocSection } from "@/components/docs/types";

const REPO = "https://github.com/biru-codeastromer/WorldModel-Gym";

export const DOCS_SECTIONS: DocSection[] = [
  // ---------------------------------------------------------------------------
  {
    slug: "overview",
    group: "Get started",
    kicker: "Introduction",
    title: "What is WorldModel Gym",
    summary:
      "An end-to-end benchmark platform for long-horizon planning agents under sparse rewards and partial observability.",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "WorldModel Gym is an end-to-end benchmark for ",
          { type: "strong", text: "long-horizon planning agents" },
          ". It pairs reproducible environments with a FastAPI submission service and this Next.js leaderboard, so an agent run can travel from evaluation harness to public dashboard through one stable API."
        ]
      },
      {
        kind: "paragraph",
        content: [
          "The platform is built around three ideas: tasks should test ",
          { type: "strong", text: "procedural generalization" },
          " (not memorized seeds), submissions should be ",
          { type: "strong", text: "reproducible and idempotent" },
          ", and the metrics that rank agents should report uncertainty, not just point estimates."
        ]
      },
      { kind: "heading", text: "How a run flows", id: "run-flow" },
      {
        kind: "list",
        ordered: true,
        items: [
          [
            "Create a run row with ",
            { type: "code", text: "POST /api/runs" },
            " — this returns a run id."
          ],
          [
            "Upload artifacts (",
            { type: "code", text: "metrics.json" },
            ", optional ",
            { type: "code", text: "trace.jsonl" },
            " and ",
            { type: "code", text: "config.json" },
            ") to ",
            { type: "code", text: "POST /api/runs/{run_id}/upload" },
            "."
          ],
          [
            "The server scores the run and surfaces it on the ",
            { type: "link", text: "leaderboard", href: "/leaderboard" },
            " by track."
          ],
          [
            "Browse the run, inspect its planner trace, and compare agents from the ",
            { type: "link", text: "dashboard", href: "/" },
            "."
          ]
        ]
      },
      {
        kind: "callout",
        tone: "info",
        title: "Same-origin by design",
        content: [
          "The browser never calls the API cross-origin. The web app proxies every request through ",
          { type: "code", text: "/api/proxy/*" },
          ", which forwards to the upstream FastAPI service and copies back the ",
          { type: "code", text: "x-request-id" },
          " for traceability."
        ]
      },
      { kind: "heading", text: "What you can do", id: "capabilities" },
      {
        kind: "list",
        items: [
          ["Create benchmark runs and upload metrics, traces, and config artifacts."],
          ["Inspect public leaderboard data filtered by track, environment, and agent."],
          ["Browse tasks and benchmark context, including planner traces and grid worlds."],
          ["Verify deployment health with readiness, liveness, and metrics endpoints."]
        ]
      },
      {
        kind: "paragraph",
        content: [
          "New here? Jump straight to the ",
          { type: "link", text: "Quickstart", href: "/docs/quickstart" },
          " to submit your first run, or read ",
          { type: "link", text: "Concepts", href: "/docs/concepts" },
          " to understand tracks, environments, and metrics."
        ]
      }
    ]
  },

  // ---------------------------------------------------------------------------
  {
    slug: "quickstart",
    group: "Get started",
    kicker: "Get started",
    title: "Quickstart",
    summary:
      "Create a run and upload artifacts via the API or CLI in a few copy-able commands.",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "This walks through submitting a run end to end. You will need a writer API key — one with the ",
          { type: "code", text: "runs:write" },
          " scope. Locally you can mint one with the CLI; in production keys are managed in your deployment provider."
        ]
      },
      { kind: "heading", text: "1. Run the stack locally", id: "local-stack" },
      {
        kind: "paragraph",
        content: [
          "From the repository root, bring the API and web stack up. ",
          { type: "code", text: "make demo" },
          " creates a run, uploads artifacts, and seeds the leaderboard flow end to end."
        ]
      },
      {
        kind: "code",
        language: "bash",
        code: "make setup\nmake demo"
      },
      {
        kind: "paragraph",
        content: [
          "The API serves at ",
          { type: "code", text: "http://localhost:8000" },
          " (interactive docs at ",
          { type: "code", text: "/docs" },
          ") and the web app at ",
          { type: "code", text: "http://localhost:3000" },
          "."
        ]
      },
      { kind: "heading", text: "2. Mint a writer API key", id: "api-key" },
      {
        kind: "code",
        language: "bash",
        label: "cli",
        code: ".venv/bin/python -m worldmodel_server.cli create-api-key \\\n  --name local-writer \\\n  --scope runs:write"
      },
      {
        kind: "callout",
        tone: "info",
        title: "Scopes",
        content: [
          "Writes require the ",
          { type: "code", text: "runs:write" },
          " scope; ",
          { type: "code", text: "admin" },
          " keys can do everything. Pass ",
          { type: "code", text: "--scope" },
          " more than once to grant multiple scopes. Public reads (leaderboard, tasks) need no key."
        ]
      },
      { kind: "heading", text: "3. Create a run", id: "create-run" },
      {
        kind: "paragraph",
        content: [
          "Send a JSON body with ",
          { type: "code", text: "env" },
          ", ",
          { type: "code", text: "agent" },
          ", and ",
          { type: "code", text: "track" },
          ". Authenticate with the ",
          { type: "code", text: "x-api-key" },
          " header. The response carries the generated run ",
          { type: "code", text: "id" },
          "."
        ]
      },
      {
        kind: "code",
        language: "bash",
        label: "curl",
        code: 'curl -sS -X POST http://localhost:8000/api/runs \\\n  -H "content-type: application/json" \\\n  -H "x-api-key: $WMG_API_KEY" \\\n  -H "Idempotency-Key: $(uuidgen)" \\\n  -d \'{"env": "memory_maze", "agent": "imagination_mpc", "track": "test"}\''
      },
      {
        kind: "code",
        language: "json",
        label: "response",
        code: '{\n  "id": "a1b2c3d4e5f6",\n  "env": "memory_maze",\n  "agent": "imagination_mpc",\n  "track": "test",\n  "status": "created",\n  "metrics": {},\n  "created_at": "2026-06-25T00:00:00Z",\n  "updated_at": "2026-06-25T00:00:00Z"\n}'
      },
      { kind: "heading", text: "4. Upload artifacts", id: "upload-artifacts" },
      {
        kind: "paragraph",
        content: [
          "Upload is ",
          { type: "code", text: "multipart/form-data" },
          " with up to three file fields. Only ",
          { type: "code", text: "metrics_file" },
          " is required; ",
          { type: "code", text: "trace_file" },
          " and ",
          { type: "code", text: "config_file" },
          " are optional."
        ]
      },
      {
        kind: "code",
        language: "bash",
        label: "curl",
        code: 'curl -sS -X POST http://localhost:8000/api/runs/$RUN_ID/upload \\\n  -H "x-api-key: $WMG_API_KEY" \\\n  -F "metrics_file=@metrics.json" \\\n  -F "trace_file=@trace.jsonl" \\\n  -F "config_file=@config.json"'
      },
      {
        kind: "callout",
        tone: "success",
        title: "One command path",
        content: [
          "Prefer a script? ",
          { type: "code", text: "scripts/demo_run.py --api-base http://localhost:8000" },
          " performs the full create-then-upload flow against a local or hosted API."
        ]
      },
      {
        kind: "paragraph",
        content: [
          "Your run now appears on the ",
          { type: "link", text: "leaderboard", href: "/leaderboard" },
          " for its track. See ",
          { type: "link", text: "Submitting runs", href: "/docs/submitting-runs" },
          " for idempotency, versioning, and the ",
          { type: "code", text: "/api/v1" },
          " surface."
        ]
      }
    ]
  },

  // ---------------------------------------------------------------------------
  {
    slug: "concepts",
    group: "Reference",
    kicker: "Concepts",
    title: "Tracks, environments & metrics",
    summary:
      "The benchmark vocabulary: tracks, environments, agents, and the metrics that rank them — including confidence intervals, model fidelity, and planning cost.",
    blocks: [
      { kind: "heading", text: "Tracks", id: "tracks" },
      {
        kind: "paragraph",
        content: [
          "A track selects which seed suite a run is evaluated against. Seed suites are fixed in code so results are reproducible."
        ]
      },
      {
        kind: "table",
        head: ["Track", "What it measures"],
        rows: [
          [[{ type: "code", text: "train" }], ["Procedural train seeds — the in-distribution baseline."]],
          [
            [{ type: "code", text: "test" }],
            ["Held-out procedural test seeds — the headline generalization number."]
          ],
          [
            [{ type: "code", text: "continual" }],
            ["Nonstationary dynamics that shift difficulty every few episodes."]
          ]
        ]
      },
      {
        kind: "callout",
        tone: "info",
        title: "Generalization gap",
        content: [
          "The gap is ",
          { type: "code", text: "train_success_rate − test_success_rate" },
          ". A small gap means the agent generalizes; a large gap means it overfit the train seeds."
        ]
      },
      { kind: "heading", text: "Environments", id: "environments" },
      {
        kind: "table",
        head: ["Environment", "Tests"],
        rows: [
          [
            [{ type: "code", text: "memory_maze" }],
            ["Partial observability + memory: navigate a maze where the goal is out of view."]
          ],
          [
            [{ type: "code", text: "switch_quest" }],
            ["Causal sub-goals: toggle switches in the right order to unlock a reward."]
          ],
          [
            [{ type: "code", text: "craft_lite" }],
            ["Compositional achievements: gather and combine resources to complete a craft tree."]
          ]
        ]
      },
      { kind: "heading", text: "Agents", id: "agents" },
      {
        kind: "paragraph",
        content: [
          "Baselines span scripted oracles to learned and planning agents. The registry ships: ",
          { type: "code", text: "random" },
          ", ",
          { type: "code", text: "greedy_oracle" },
          ", ",
          { type: "code", text: "planner_oracle" },
          ", ",
          { type: "code", text: "imagination_mpc" },
          ", ",
          { type: "code", text: "search_mcts" },
          ", and ",
          { type: "code", text: "ppo" },
          "."
        ]
      },
      {
        kind: "callout",
        tone: "info",
        title: "Custom agents",
        content: [
          "An agent implements ",
          { type: "code", text: "reset(seed)" },
          ", ",
          { type: "code", text: "act(obs, info)" },
          ", and ",
          { type: "code", text: "observe(transition)" },
          ", with an optional ",
          { type: "code", text: "get_trace()" },
          " for planner debug output. Register it in ",
          { type: "code", text: "agents/worldmodel_agents/registry.py" },
          "."
        ]
      },
      { kind: "heading", text: "Metrics", id: "metrics" },
      {
        kind: "paragraph",
        content: [
          "Runs report scalar metrics plus structured sub-objects. The leaderboard ranks on success rate but surfaces uncertainty and cost alongside it."
        ]
      },
      {
        kind: "table",
        head: ["Metric", "Meaning"],
        rows: [
          [[{ type: "code", text: "success_rate" }], ["Fraction of episodes solved — the primary ranking metric."]],
          [[{ type: "code", text: "mean_return" }], ["Average episode return."]],
          [
            [{ type: "code", text: "success_rate_ci" }],
            ["A ", { type: "code", text: "[low, high]" }, " confidence interval, rendered as a whisker on the leaderboard."]
          ],
          [
            [{ type: "code", text: "median_steps_to_success" }],
            ["Sample efficiency — how quickly the agent reaches the goal."]
          ],
          [
            [{ type: "code", text: "model_fidelity" }],
            ["k-step reward error of the world model at ", { type: "code", text: "k1 / k5 / k20" }, " horizons."]
          ],
          [
            [{ type: "code", text: "planning_cost" }],
            ["Compute cost, including ", { type: "code", text: "wall_clock_ms_per_step" }, " and imagined transitions."]
          ],
          [
            [{ type: "code", text: "generalization_gap" }],
            ["Train vs. test success-rate delta."]
          ]
        ]
      },
      {
        kind: "callout",
        tone: "warning",
        title: "Why confidence intervals matter",
        content: [
          "Two agents with the same point success rate are not equal if one has a far wider interval. The leaderboard always renders the CI so rankings stay honest about sample size and variance."
        ]
      },
      {
        kind: "paragraph",
        content: [
          "The ",
          { type: "code", text: "continual" },
          " track adds transfer metrics: ",
          { type: "code", text: "forward_transfer" },
          ", ",
          { type: "code", text: "backward_transfer" },
          ", and ",
          { type: "code", text: "forgetting" },
          "."
        ]
      }
    ]
  },

  // ---------------------------------------------------------------------------
  {
    slug: "submitting-runs",
    group: "Reference",
    kicker: "API reference",
    title: "Submitting runs",
    summary:
      "The submission API in detail: POST /api/runs, artifact upload, the Idempotency-Key header, and the versioned /api/v1 surface.",
    blocks: [
      { kind: "heading", text: "Authentication", id: "auth" },
      {
        kind: "paragraph",
        content: [
          "Writes are authenticated with the ",
          { type: "code", text: "x-api-key" },
          " header carrying a key scoped to ",
          { type: "code", text: "runs:write" },
          " (or ",
          { type: "code", text: "admin" },
          "). Reads — leaderboard, tasks, run detail, trace — are public."
        ]
      },
      { kind: "heading", text: "Create a run", id: "post-runs" },
      {
        kind: "paragraph",
        content: [
          { type: "code", text: "POST /api/runs" },
          " accepts a JSON body. ",
          { type: "code", text: "env" },
          " and ",
          { type: "code", text: "agent" },
          " are required; ",
          { type: "code", text: "track" },
          " defaults to ",
          { type: "code", text: "test" },
          ". Supplying ",
          { type: "code", text: "id" },
          " lets you choose the run id (otherwise one is generated). Reusing an existing id returns ",
          { type: "code", text: "409" },
          "."
        ]
      },
      {
        kind: "code",
        language: "json",
        label: "request body",
        code: '{\n  "env": "switch_quest",\n  "agent": "search_mcts",\n  "track": "test"\n}'
      },
      { kind: "heading", text: "Upload artifacts", id: "post-upload" },
      {
        kind: "paragraph",
        content: [
          { type: "code", text: "POST /api/runs/{run_id}/upload" },
          " is ",
          { type: "code", text: "multipart/form-data" },
          " with these fields:"
        ]
      },
      {
        kind: "table",
        head: ["Field", "Required", "Contents"],
        rows: [
          [[{ type: "code", text: "metrics_file" }], ["yes"], [{ type: "code", text: "metrics.json" }, " — the scored metrics blob."]],
          [[{ type: "code", text: "trace_file" }], ["no"], [{ type: "code", text: "trace.jsonl" }, " — NDJSON planner / episode trace."]],
          [[{ type: "code", text: "config_file" }], ["no"], [{ type: "code", text: "config.json" }, " — the run configuration."]]
        ]
      },
      {
        kind: "callout",
        tone: "info",
        title: "metrics.json shape",
        content: [
          "Unknown keys are preserved, but the recognized scalars are ",
          { type: "code", text: "success_rate" },
          " and ",
          { type: "code", text: "mean_return" },
          ", with structured ",
          { type: "code", text: "planning_cost" },
          " and ",
          { type: "code", text: "model_fidelity" },
          " sub-objects and optional ",
          { type: "code", text: "success_rate_ci" },
          "."
        ]
      },
      {
        kind: "code",
        language: "json",
        label: "metrics.json",
        code: '{\n  "success_rate": 0.82,\n  "success_rate_ci": [0.76, 0.88],\n  "mean_return": 14.3,\n  "planning_cost": { "wall_clock_ms_per_step": 12.4 },\n  "model_fidelity": { "k1": 0.97, "k5": 0.81, "k20": 0.55 }\n}'
      },
      { kind: "heading", text: "Idempotency", id: "idempotency" },
      {
        kind: "paragraph",
        content: [
          "Both write endpoints honor an ",
          { type: "code", text: "Idempotency-Key" },
          " header. A record is scoped to ",
          { type: "code", text: "(key, principal, method, path)" },
          ": if the same key is replayed with the ",
          { type: "strong", text: "same body" },
          ", the server replays the original response instead of performing a second write. Reusing a key with a ",
          { type: "strong", text: "different body" },
          " is rejected."
        ]
      },
      {
        kind: "callout",
        tone: "warning",
        title: "Safe retries",
        content: [
          "Generate a fresh key per logical submission (e.g. ",
          { type: "code", text: "uuidgen" },
          ") and reuse it on retry. Keys expire after ",
          { type: "code", text: "WMG_IDEMPOTENCY_TTL_HOURS" },
          " (default 24h)."
        ]
      },
      { kind: "heading", text: "Versioned surface: /api/v1", id: "api-v1" },
      {
        kind: "paragraph",
        content: [
          "Every route is mounted under both ",
          { type: "code", text: "/api" },
          " (the stable surface the web proxy and mobile viewer use) and ",
          { type: "code", text: "/api/v1" },
          " (the explicitly versioned surface). They are independent for idempotency scoping. Prefer ",
          { type: "code", text: "/api/v1" },
          " for new integrations."
        ]
      },
      {
        kind: "code",
        language: "bash",
        label: "curl",
        code: 'curl -sS -X POST https://your-api.example.com/api/v1/runs \\\n  -H "content-type: application/json" \\\n  -H "x-api-key: $WMG_API_KEY" \\\n  -H "Idempotency-Key: $(uuidgen)" \\\n  -d \'{"env": "craft_lite", "agent": "ppo", "track": "train"}\''
      },
      { kind: "heading", text: "Reading results", id: "reads" },
      {
        kind: "table",
        head: ["Endpoint", "Returns"],
        rows: [
          [[{ type: "code", text: "GET /api/leaderboard?track=test" }], ["Ranked rows for a track (filter with ", { type: "code", text: "env" }, " / ", { type: "code", text: "agent" }, ")."]],
          [[{ type: "code", text: "GET /api/tasks" }], ["The catalog of benchmark tasks and defaults."]],
          [[{ type: "code", text: "GET /api/runs/{id}" }], ["A single run with its metrics and artifact URLs."]],
          [[{ type: "code", text: "GET /api/runs/{id}/trace" }], ["The NDJSON planner / episode trace."]]
        ]
      }
    ]
  },

  // ---------------------------------------------------------------------------
  {
    slug: "deployment",
    group: "Operations",
    kicker: "Operations",
    title: "Deployment & operations",
    summary:
      "The production shape: Render API, Vercel web, managed Postgres, S3-compatible artifact storage, and health endpoints.",
    blocks: [
      {
        kind: "paragraph",
        content: [
          "The default production topology is a FastAPI service on Render, this Next.js dashboard on Vercel (deployed from the ",
          { type: "code", text: "web/" },
          " root), managed Postgres for run metadata, and local or S3-compatible storage for artifacts."
        ]
      },
      { kind: "heading", text: "Health & monitoring", id: "health" },
      {
        kind: "table",
        head: ["Endpoint", "Purpose"],
        rows: [
          [[{ type: "code", text: "/healthz" }], ["Liveness — the process is up."]],
          [[{ type: "code", text: "/readyz" }], ["Readiness — dependencies (DB, storage) are reachable."]],
          [[{ type: "code", text: "/metrics" }], ["Prometheus metrics for scraping."]]
        ]
      },
      {
        kind: "callout",
        tone: "info",
        title: "Web smoke path",
        content: [
          "The proxy round-trip ",
          { type: "code", text: "/api/proxy/api/leaderboard?track=test" },
          " is the quickest end-to-end check that the web app can reach the API."
        ]
      },
      { kind: "heading", text: "Web app configuration", id: "web-config" },
      {
        kind: "paragraph",
        content: [
          "The web app forwards browser requests through its proxy. Point it at your API with ",
          { type: "code", text: "NEXT_PUBLIC_API_BASE" },
          " (or ",
          { type: "code", text: "INTERNAL_API_BASE" },
          " for server-side calls). Both default to ",
          { type: "code", text: "http://localhost:8000" },
          "."
        ]
      },
      {
        kind: "code",
        language: "bash",
        label: "env",
        code: "NEXT_PUBLIC_API_BASE=https://your-api.example.com"
      },
      { kind: "heading", text: "Operating the API", id: "ops" },
      {
        kind: "list",
        items: [
          ["Run Alembic migrations on deploy rather than relying on implicit schema creation."],
          [
            "Manage scoped API keys with the CLI: ",
            { type: "code", text: "create-api-key" },
            ", ",
            { type: "code", text: "rotate-api-key" },
            ", ",
            { type: "code", text: "revoke-api-key" },
            ", and ",
            { type: "code", text: "list-api-keys" },
            "."
          ],
          ["Switch artifact storage to S3-compatible storage for durable production uploads."],
          [
            "Remove the bootstrap key (",
            { type: "code", text: "WMG_BOOTSTRAP_API_KEY" },
            ") once the first durable writer key exists."
          ]
        ]
      },
      {
        kind: "callout",
        tone: "success",
        title: "Verify a deployment",
        content: [
          "Run ",
          { type: "code", text: "scripts/verify_deployment.py --api-base <api> --web-base <web>" },
          " to check readiness, the leaderboard flow, and the web smoke path in one pass."
        ]
      },
      {
        kind: "paragraph",
        content: [
          "Source and full runbooks live in the ",
          { type: "link", text: "repository", href: REPO },
          " — backend under ",
          { type: "code", text: "server/" },
          ", web under ",
          { type: "code", text: "web/" },
          "."
        ]
      }
    ]
  }
];

/** Section lookup by slug. */
export function getDocSection(slug: string): DocSection | undefined {
  return DOCS_SECTIONS.find((s) => s.slug === slug);
}

/** Ordered slugs for prev/next navigation and static params. */
export const DOC_SLUGS: string[] = DOCS_SECTIONS.map((s) => s.slug);

/** Sidebar groups in declaration order, preserving section order within each. */
export function getDocGroups(): { group: string; sections: DocSection[] }[] {
  const order: string[] = [];
  const map = new Map<string, DocSection[]>();
  for (const section of DOCS_SECTIONS) {
    if (!map.has(section.group)) {
      map.set(section.group, []);
      order.push(section.group);
    }
    map.get(section.group)!.push(section);
  }
  return order.map((group) => ({ group, sections: map.get(group)! }));
}

/** Extract the heading anchors from a section for the "On this page" rail. */
export function getSectionAnchors(section: DocSection): AnchorItem[] {
  return section.blocks
    .filter((b): b is Extract<typeof b, { kind: "heading" }> => b.kind === "heading")
    .map((b) => ({ id: b.id, text: b.text }));
}
