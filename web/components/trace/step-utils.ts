// Defensive accessors that read the *passthrough* fields of a normalized
// TraceStep. lib/trace.ts guarantees `t` and `events` exist, but everything
// else (reward, action, done flags, ...) arrives from untrusted NDJSON and may
// be missing, mistyped, or shaped unexpectedly. These helpers never throw and
// always return display-ready primitives so the player can render any trace.

import { toFiniteNumber } from "@/lib/api";
import type { TraceEpisode, TraceStep } from "@/lib/trace";

/** Read a finite numeric `reward` from a step, or null when absent/invalid. */
export function stepReward(step: TraceStep | undefined): number | null {
  if (!step) return null;
  return toFiniteNumber((step as Record<string, unknown>).reward);
}

/**
 * Best-effort human label for the action taken at a step. Actions show up under
 * a handful of keys and may be numbers, strings, or small arrays/objects.
 */
export function stepAction(step: TraceStep | undefined): string | null {
  if (!step) return null;
  const record = step as Record<string, unknown>;
  const raw = record.action ?? record.act ?? record.a;
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string") return raw || null;
  if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : null;
  if (typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw)) {
    const parts = raw
      .map((v) => (typeof v === "number" || typeof v === "string" ? String(v) : null))
      .filter((v): v is string => v !== null);
    return parts.length ? `[${parts.join(", ")}]` : null;
  }
  try {
    const s = JSON.stringify(raw);
    return s && s.length <= 64 ? s : "object";
  } catch {
    return "object";
  }
}

/**
 * Whether a step terminates the episode. Reads the common RL flags
 * (`done`, `terminated`, `truncated`) truthily; tolerates string "true".
 */
export function stepTerminal(step: TraceStep | undefined): {
  done: boolean;
  terminated: boolean;
  truncated: boolean;
} {
  const record = (step ?? {}) as Record<string, unknown>;
  const flag = (v: unknown) => v === true || v === "true" || v === 1;
  return {
    done: flag(record.done),
    terminated: flag(record.terminated),
    truncated: flag(record.truncated)
  };
}

/** A few well-known "success" / "goal" event names, matched case-insensitively. */
const SUCCESS_EVENT = /(success|goal|win|reach|solved|complete)/i;
const FAILURE_EVENT = /(fail|lose|lost|dead|death|crash|timeout|truncat)/i;

export type EventTone = "success" | "danger" | "neutral";

/** Classify a semantic event name into a badge tone. */
export function eventTone(name: string): EventTone {
  if (SUCCESS_EVENT.test(name)) return "success";
  if (FAILURE_EVENT.test(name)) return "danger";
  return "neutral";
}

/**
 * Precompute cumulative return (running reward sum) across an episode's steps so
 * the detail panel can show "return so far" without re-summing every render.
 * Missing rewards count as 0 toward the cumulative total.
 */
export function cumulativeReturns(steps: TraceStep[]): number[] {
  let acc = 0;
  return steps.map((s) => {
    const r = stepReward(s);
    acc += r ?? 0;
    return acc;
  });
}

/** Total finite reward for an episode (its return). */
export function episodeReturn(episode: TraceEpisode | undefined): number | null {
  const steps = episode?.steps ?? [];
  let acc = 0;
  let sawReward = false;
  for (const s of steps) {
    const r = stepReward(s);
    if (r !== null) {
      acc += r;
      sawReward = true;
    }
  }
  return sawReward ? acc : null;
}

/** Does any step in the episode carry a success-flavored event? */
export function episodeSucceeded(episode: TraceEpisode | undefined): boolean {
  for (const s of episode?.steps ?? []) {
    for (const e of s.events ?? []) {
      if (eventTone(e) === "success") return true;
    }
  }
  return false;
}

/** Short label for an episode in the selector, e.g. "Episode 3 · 24 steps". */
export function episodeLabel(episode: TraceEpisode, index: number): string {
  const n = episode.steps?.length ?? 0;
  return `Episode ${index + 1} · ${n} ${n === 1 ? "step" : "steps"}`;
}
