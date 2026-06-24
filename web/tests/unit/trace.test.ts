import { describe, expect, it } from "vitest";

import { extractEvents, normalizeEpisodes } from "@/lib/trace";

describe("normalizeEpisodes", () => {
  it("returns episode-shaped input unchanged", () => {
    const input = [{ steps: [{ t: 0, events: [] }] }, { steps: [] }];

    expect(normalizeEpisodes(input)).toBe(input);
  });

  it("wraps a flat list of steps into a single episode", () => {
    const input = [
      { action: "left", events: ["start"] },
      { action: "right" }
    ];

    const out = normalizeEpisodes(input);

    expect(out).toHaveLength(1);
    expect(out[0].steps).toHaveLength(2);
  });

  it("backfills t from t, then step, then array index", () => {
    const input = [
      { t: 7 }, // explicit t wins
      { step: 3 }, // falls back to step
      {} // falls back to index (2)
    ];

    const out = normalizeEpisodes(input);
    const ts = out[0].steps.map((s) => s.t);

    expect(ts).toEqual([7, 3, 2]);
  });

  it("coerces a non-array events field into an empty array", () => {
    const input = [{ events: "oops" }, { events: ["ok"] }];

    const out = normalizeEpisodes(input);

    expect(out[0].steps[0].events).toEqual([]);
    expect(out[0].steps[1].events).toEqual(["ok"]);
  });

  it("treats an empty trace as the episode shape (returns it unchanged)", () => {
    const input: any[] = [];

    expect(normalizeEpisodes(input)).toBe(input);
  });
});

describe("extractEvents", () => {
  it("flattens events across episodes and steps with their timestamps", () => {
    const episodes = [
      { steps: [{ t: 0, events: ["a", "b"] }, { t: 1, events: ["c"] }] },
      { steps: [{ t: 2, events: ["d"] }] }
    ];

    expect(extractEvents(episodes)).toEqual([
      { t: 0, name: "a" },
      { t: 0, name: "b" },
      { t: 1, name: "c" },
      { t: 2, name: "d" }
    ]);
  });

  it("tolerates episodes/steps missing the steps or events arrays", () => {
    const episodes = [
      {}, // no steps
      { steps: [{ t: 5 }] }, // step with no events
      { steps: [{ t: 6, events: ["x"] }] }
    ];

    expect(extractEvents(episodes)).toEqual([{ t: 6, name: "x" }]);
  });

  it("returns an empty list for an empty input", () => {
    expect(extractEvents([])).toEqual([]);
  });

  it("composes with normalizeEpisodes on a flat step list", () => {
    const flat = [{ events: ["boot"] }, { t: 4, events: ["land"] }];

    const events = extractEvents(normalizeEpisodes(flat));

    expect(events).toEqual([
      { t: 0, name: "boot" },
      { t: 4, name: "land" }
    ]);
  });
});
