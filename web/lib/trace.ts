// Trace pipeline helpers shared by the run viewer page and unit tests.
//
// Extracted from app/runs/[id]/page.tsx (Phase 4 / workstream 3) so the
// normalization/event-extraction logic is importable and unit-testable without
// rendering a React component.
//
// Phase 5 (workstream FE): the raw trace records arrive as untrusted NDJSON, so
// the previously `any`-typed structures are now described by zod schemas. The
// normalisers parse defensively (a single malformed episode/step must not throw
// or white-screen the run page) and fall back to safe empty shapes.

import { z } from "zod";

export const TraceStepSchema = z
  .object({
    t: z.number().optional(),
    step: z.number().optional(),
    events: z.array(z.string()).optional(),
    planner: z.record(z.unknown()).optional()
  })
  .passthrough();

export const TraceEpisodeSchema = z
  .object({
    steps: z.array(TraceStepSchema)
  })
  .passthrough();

/**
 * Loose "is this episode-shaped?" check: only that a `steps` array is present.
 * Individual steps are normalised defensively afterwards, so we must NOT reject
 * an episode just because one of its steps is malformed.
 */
const EpisodeShapeSchema = z
  .object({
    steps: z.array(z.unknown())
  })
  .passthrough();

export type TraceStep = {
  t: number;
  events: string[];
  planner?: Record<string, unknown>;
  [key: string]: unknown;
};

export type TraceEpisode = {
  steps: TraceStep[];
  [key: string]: unknown;
};

export type TraceEvent = {
  t: number;
  name: string;
};

/** True when a raw record looks like an episode (has a `steps` array). */
function isEpisodeShaped(entry: unknown): boolean {
  return EpisodeShapeSchema.safeParse(entry).success;
}

/** Coerce one raw record into a normalised TraceStep, NaN/shape-guarded. */
function normalizeStep(raw: unknown, index: number): TraceStep {
  const record = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) ?? {};
  const rawT = record.t ?? record.step ?? index;
  const t = typeof rawT === "number" && Number.isFinite(rawT) ? rawT : index;
  const events = Array.isArray(record.events)
    ? record.events.filter((e): e is string => typeof e === "string")
    : [];
  const planner =
    record.planner && typeof record.planner === "object"
      ? (record.planner as Record<string, unknown>)
      : undefined;
  return { ...record, t, events, ...(planner ? { planner } : {}) };
}

/**
 * Normalize raw NDJSON trace records into a list of episodes.
 *
 * Two input shapes are supported:
 *  - "episode" shape: every entry already has a `steps` array -> each episode's
 *    steps are individually normalised (t backfilled, events coerced) so a
 *    malformed step inside an otherwise valid episode cannot break rendering.
 *  - "flat step" shape: a list of step records -> wrapped into a single episode,
 *    backfilling `t` (from `t`, then `step`, then the array index) and ensuring
 *    `events` is always an array.
 *
 * An empty input returns an empty list of episodes.
 */
export function normalizeEpisodes(trace: unknown[]): TraceEpisode[] {
  if (trace.every((entry) => isEpisodeShaped(entry))) {
    return trace.map((entry) => {
      const record = entry as Record<string, unknown>;
      const steps = Array.isArray(record.steps) ? record.steps : [];
      return { ...record, steps: steps.map((step, index) => normalizeStep(step, index)) };
    });
  }
  return [
    {
      steps: trace.map((step, index) => normalizeStep(step, index))
    }
  ];
}

/**
 * Flatten normalized episodes into a list of {t, name} semantic events.
 * Tolerates missing `steps`/`events` arrays on malformed input.
 */
export function extractEvents(trace: unknown[]): TraceEvent[] {
  const events: TraceEvent[] = [];
  trace.forEach((episode) => {
    const steps = (episode as TraceEpisode | undefined)?.steps ?? [];
    (Array.isArray(steps) ? steps : []).forEach((step) => {
      const stepEvents = (step as TraceStep | undefined)?.events ?? [];
      (Array.isArray(stepEvents) ? stepEvents : []).forEach((evt) => {
        if (typeof evt === "string") {
          events.push({ t: (step as TraceStep).t, name: evt });
        }
      });
    });
  });
  return events;
}
