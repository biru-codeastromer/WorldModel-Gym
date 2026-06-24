import { describe, expect, it } from "vitest";

import {
  LeaderboardRowSchema,
  LeaderboardSchema,
  RunMetricsSchema,
  RunResponseSchema,
  TasksResponseSchema,
  formatMetric,
  parseWith,
  toFiniteNumber
} from "@/lib/api";

describe("toFiniteNumber", () => {
  it("passes through finite numbers", () => {
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber(-3.5)).toBe(-3.5);
    expect(toFiniteNumber(42)).toBe(42);
  });

  it("rejects NaN and Infinity", () => {
    expect(toFiniteNumber(NaN)).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
    expect(toFiniteNumber(-Infinity)).toBeNull();
  });

  it("parses numeric strings and rejects unparseable ones", () => {
    expect(toFiniteNumber("1.25")).toBe(1.25);
    expect(toFiniteNumber("  7 ")).toBe(7);
    expect(toFiniteNumber("not-a-number")).toBeNull();
    expect(toFiniteNumber("")).toBeNull();
  });

  it("rejects null, undefined, and objects", () => {
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(undefined)).toBeNull();
    expect(toFiniteNumber({})).toBeNull();
    expect(toFiniteNumber([])).toBeNull();
  });
});

describe("formatMetric", () => {
  it("formats finite values with the requested precision", () => {
    expect(formatMetric(0.5)).toBe("0.50");
    expect(formatMetric(0.12345, 3)).toBe("0.123");
    expect(formatMetric(10, 0)).toBe("10");
  });

  it("never renders NaN/undefined — falls back to a placeholder", () => {
    expect(formatMetric(NaN)).toBe("--");
    expect(formatMetric(undefined)).toBe("--");
    expect(formatMetric(null)).toBe("--");
    expect(formatMetric(Infinity)).toBe("--");
    expect(formatMetric("oops")).toBe("--");
  });

  it("honours a custom fallback", () => {
    expect(formatMetric(undefined, 2, "n/a")).toBe("n/a");
  });
});

describe("RunMetricsSchema", () => {
  it("parses a full metrics blob and preserves unknown keys", () => {
    const parsed = RunMetricsSchema.parse({
      success_rate: 0.8,
      mean_return: 1.2,
      planning_cost: { wall_clock_ms_per_step: 18.6 },
      model_fidelity: { k1: 0.91, k5: 0.7, k20: 0.4 },
      success_rate_ci: [0.75, 0.85],
      per_seed: [{ seed: 1, success_rate: 0.8 }],
      notes: "kept"
    });

    expect(parsed.success_rate).toBe(0.8);
    expect(parsed.model_fidelity?.k1).toBe(0.91);
    expect((parsed as Record<string, unknown>).notes).toBe("kept");
  });

  it("NaN-guards numeric fields into null instead of NaN", () => {
    const parsed = RunMetricsSchema.parse({
      success_rate: Number.NaN,
      mean_return: "not-a-number",
      model_fidelity: { k1: Number.POSITIVE_INFINITY }
    });

    expect(parsed.success_rate).toBeNull();
    expect(parsed.mean_return).toBeNull();
    expect(parsed.model_fidelity?.k1).toBeNull();
  });

  it("accepts an empty metrics object (all fields optional)", () => {
    expect(RunMetricsSchema.parse({})).toEqual({});
  });

  it("coerces numeric strings to numbers", () => {
    const parsed = RunMetricsSchema.parse({ success_rate: "0.42" });
    expect(parsed.success_rate).toBe(0.42);
  });
});

describe("LeaderboardRowSchema / LeaderboardSchema", () => {
  it("parses a valid row", () => {
    const row = LeaderboardRowSchema.parse({
      run_id: "r1",
      env: "memory_maze",
      agent: "ppo",
      track: "test",
      success_rate: 0.7,
      mean_return: 1.1,
      planning_cost_ms_per_step: 9.4,
      created_at: "2026-01-01T00:00:00Z"
    });

    expect(row.run_id).toBe("r1");
    expect(row.planning_cost_ms_per_step).toBe(9.4);
  });

  it("NaN-guards a malformed numeric metric to null rather than rejecting the row", () => {
    const row = LeaderboardRowSchema.parse({
      run_id: "r2",
      env: "e",
      agent: "a",
      track: "t",
      success_rate: Number.NaN,
      mean_return: 0,
      planning_cost_ms_per_step: 0,
      created_at: "2026-01-01T00:00:00Z"
    });

    expect(row.success_rate).toBeNull();
  });

  it("rejects a row missing required string identifiers", () => {
    expect(
      LeaderboardSchema.safeParse([{ env: "e", agent: "a", track: "t", created_at: "x" }]).success
    ).toBe(false);
  });
});

describe("RunResponseSchema", () => {
  it("defaults metrics to an empty object when omitted", () => {
    const run = RunResponseSchema.parse({
      id: "run-1",
      env: "e",
      agent: "a",
      track: "t",
      status: "uploaded",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z"
    });

    expect(run.metrics).toEqual({});
  });

  it("rejects a run missing required fields", () => {
    expect(RunResponseSchema.safeParse({ id: "x" }).success).toBe(false);
  });
});

describe("parseWith", () => {
  it("returns parsed data on success", () => {
    const data = parseWith(TasksResponseSchema, { tasks: [{ id: "t", description: "d" }] }, "tasks");
    expect(data.tasks[0].id).toBe("t");
  });

  it("throws a readable, label-bearing error on a malformed payload", () => {
    expect(() => parseWith(TasksResponseSchema, { wrong: true }, "tasks")).toThrow(
      "Malformed tasks response from API"
    );
  });
});
