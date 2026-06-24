import { z } from "zod";

export function getApiBase() {
  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  }
  return "/api/proxy";
}

// ---------------------------------------------------------------------------
// Zod schemas mirroring the server Pydantic / SQLAlchemy models.
//
// The API is trusted but not infallible: a malformed metrics blob, a partially
// written run row, or a schema drift between server and client should degrade
// gracefully instead of white-screening a page. Every response is parsed
// through one of these schemas; numeric formatters then NaN-guard the result so
// nothing renders as `NaN`/`undefined`.
// ---------------------------------------------------------------------------

/**
 * A finite number, or null when the source value is missing/NaN/non-finite.
 *
 * Note: zod's `z.number()` allows NaN by default, so a NaN slips through the
 * union and is collapsed to null by the transform rather than failing parsing.
 * Strings are coerced; non-numeric input becomes null. The field is nullish so a
 * malformed numeric never rejects the surrounding object.
 */
function coerceFinite(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

const finiteNumber = z
  .union([z.number(), z.nan(), z.string()])
  .nullish()
  .transform(coerceFinite);

/**
 * Like `finiteNumber` but the field must be present (a leaderboard row always
 * carries the column, even if its value is NaN/null). The output is `number | null`
 * with no `undefined`, so it satisfies consumers like the chart that expect the
 * key to exist.
 */
const finiteNumberRequired = z
  .union([z.number(), z.nan(), z.string(), z.null()])
  .transform(coerceFinite);

/** Model-fidelity sub-object: `k1`/`k5`/`k20` rollout-horizon fidelity scores. */
const ModelFidelitySchema = z
  .object({
    k1: finiteNumber,
    k5: finiteNumber,
    k20: finiteNumber
  })
  .partial()
  .passthrough();

/** Planning-cost sub-object as emitted by the server seed/runner. */
const PlanningCostSchema = z
  .object({
    wall_clock_ms_per_step: finiteNumber
  })
  .partial()
  .passthrough();

/** A two-element [low, high] confidence interval, NaN-guarded. */
const ConfidenceIntervalSchema = z
  .union([z.tuple([finiteNumber, finiteNumber]), z.array(finiteNumber)])
  .nullish();

/**
 * Run metrics. Mirrors the free-form `metrics: dict` the server stores. The
 * core scalars (success_rate, mean_return) and the planning_cost / model_fidelity
 * objects are recognised; the newer CI and per-seed fields are optional. Unknown
 * keys are preserved via `.passthrough()` so the raw blob stays inspectable.
 */
export const RunMetricsSchema = z
  .object({
    success_rate: finiteNumber,
    mean_return: finiteNumber,
    planning_cost: z.union([PlanningCostSchema, finiteNumber]).nullish(),
    model_fidelity: ModelFidelitySchema.nullish(),
    success_rate_ci: ConfidenceIntervalSchema,
    mean_return_ci: ConfidenceIntervalSchema,
    per_seed: z.array(z.record(z.unknown())).nullish()
  })
  .partial()
  .passthrough();

export type RunMetrics = z.infer<typeof RunMetricsSchema>;

export const LeaderboardRowSchema = z.object({
  run_id: z.string(),
  env: z.string(),
  agent: z.string(),
  track: z.string(),
  success_rate: finiteNumberRequired,
  mean_return: finiteNumberRequired,
  planning_cost_ms_per_step: finiteNumberRequired,
  created_at: z.string()
});

export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;

export const LeaderboardSchema = z.array(LeaderboardRowSchema);

export const TaskRecordSchema = z.object({
  id: z.string(),
  description: z.string(),
  defaults: z.record(z.unknown()).optional()
});

export type TaskRecord = z.infer<typeof TaskRecordSchema>;

export const TasksResponseSchema = z.object({
  tasks: z.array(TaskRecordSchema)
});

export const RunResponseSchema = z.object({
  id: z.string(),
  env: z.string(),
  agent: z.string(),
  track: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  metrics: RunMetricsSchema.default({}),
  trace_url: z.string().nullish(),
  config_url: z.string().nullish()
});

export type RunResponse = z.infer<typeof RunResponseSchema>;

export type RunCreatePayload = {
  id?: string;
  env: string;
  agent: string;
  track: string;
};

/**
 * Parse an unknown API payload through a zod schema, raising a readable error
 * (rather than a raw ZodError) when the response shape is unexpected.
 */
export function parseWith<S extends z.ZodTypeAny>(schema: S, data: unknown, label: string): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Malformed ${label} response from API`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// NaN-guarded numeric formatters. These are the only place the UI turns a metric
// into text, so they centralise the "never render NaN/undefined" guarantee.
// ---------------------------------------------------------------------------

/**
 * Coerce an unknown value to a finite number, or return null. Strings that
 * parse to finite numbers are accepted; NaN, Infinity, null, undefined, objects,
 * and unparseable strings all collapse to null.
 */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Format a metric to fixed decimals, substituting a placeholder when absent. */
export function formatMetric(value: unknown, digits = 2, fallback = "--"): string {
  const n = toFiniteNumber(value);
  return n === null ? fallback : n.toFixed(digits);
}

async function fetchValidated<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  label: string
): Promise<z.infer<S>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    const data = (await res.json()) as unknown;
    return parseWith(schema, data, label);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out while contacting the API");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse<S extends z.ZodTypeAny>(
  res: Response,
  schema: S,
  label: string
): Promise<z.infer<S>> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) {
        message = body.detail;
      }
    } catch {
      // ignore secondary parse failures
    }
    throw new Error(message);
  }
  const data = (await res.json()) as unknown;
  return parseWith(schema, data, label);
}

export async function fetchTasks() {
  return fetchValidated("/api/tasks", TasksResponseSchema, "tasks");
}

export async function fetchLeaderboard(track: string) {
  return fetchValidated(`/api/leaderboard?track=${track}`, LeaderboardSchema, "leaderboard");
}

export async function fetchRun(runId: string) {
  return fetchValidated(`/api/runs/${runId}`, RunResponseSchema, "run");
}

export async function fetchTrace(runId: string) {
  const res = await fetch(`${getApiBase()}/api/runs/${runId}/trace`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch trace");
  }
  const txt = await res.text();
  return parseTraceNdjson(txt);
}

/**
 * Parse NDJSON trace text into an array of records.
 *
 * Robustness fix (Phase 4 / workstream 3): previously this mapped every
 * non-empty line through `JSON.parse` with no error handling, so a single
 * malformed or truncated line (common when a trace stream is cut off mid-write)
 * would throw and discard the entire trace. We now skip lines that fail to
 * parse instead of throwing, so a partial trace still renders. Skipped lines
 * are reported via the optional `onError` callback for diagnostics.
 */
export function parseTraceNdjson(
  text: string,
  onError?: (line: string, error: unknown) => void
): unknown[] {
  const records: unknown[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      records.push(JSON.parse(trimmed));
    } catch (error) {
      onError?.(trimmed, error);
    }
  }
  return records;
}

export async function createRun(payload: RunCreatePayload, apiKey: string) {
  const res = await fetch(`${getApiBase()}/api/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify(payload)
  });

  return parseJsonResponse(res, RunResponseSchema, "run");
}

export async function uploadRunArtifacts(
  runId: string,
  files: {
    metricsFile: File;
    traceFile?: File | null;
    configFile?: File | null;
  },
  apiKey: string
) {
  const body = new FormData();
  body.append("metrics_file", files.metricsFile);
  if (files.traceFile) {
    body.append("trace_file", files.traceFile);
  }
  if (files.configFile) {
    body.append("config_file", files.configFile);
  }

  const res = await fetch(`${getApiBase()}/api/runs/${runId}/upload`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey
    },
    body
  });

  return parseJsonResponse(res, RunResponseSchema, "run");
}
