// Trace pipeline helpers shared by the run viewer page and unit tests.
//
// Extracted from app/runs/[id]/page.tsx (Phase 4 / workstream 3) so the
// normalization/event-extraction logic is importable and unit-testable without
// rendering a React component.

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

/**
 * Normalize raw NDJSON trace records into a list of episodes.
 *
 * Two input shapes are supported:
 *  - "episode" shape: every entry already has a `steps` array -> returned as-is.
 *  - "flat step" shape: a list of step records -> wrapped into a single episode,
 *    backfilling `t` (from `t`, then `step`, then the array index) and ensuring
 *    `events` is always an array.
 *
 * An empty input returns a single empty episode (`[]` does not satisfy the
 * `every(...)` episode check via vacuous truth in the original code path, so we
 * keep that behavior: an empty array is treated as the episode shape).
 */
export function normalizeEpisodes(trace: any[]): TraceEpisode[] {
  if (trace.every((entry) => Array.isArray(entry?.steps))) {
    return trace as TraceEpisode[];
  }
  return [
    {
      steps: trace.map((step: any, index: number) => ({
        ...step,
        t: step?.t ?? step?.step ?? index,
        events: Array.isArray(step?.events) ? step.events : []
      }))
    }
  ];
}

/**
 * Flatten normalized episodes into a list of {t, name} semantic events.
 * Tolerates missing `steps`/`events` arrays on malformed input.
 */
export function extractEvents(trace: any[]): TraceEvent[] {
  const events: TraceEvent[] = [];
  trace.forEach((episode) => {
    (episode?.steps ?? []).forEach((step: any) => {
      (step?.events ?? []).forEach((evt: string) => events.push({ t: step.t, name: evt }));
    });
  });
  return events;
}
