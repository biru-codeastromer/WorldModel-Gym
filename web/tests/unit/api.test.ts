import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRun,
  fetchLeaderboard,
  fetchTasks,
  fetchTrace,
  parseTraceNdjson,
  uploadRunArtifacts
} from "@/lib/api";

/** Shape of a parsed NDJSON trace entry as exercised by these tests. */
type TraceEntry = { steps: Array<{ t: number }> };

/** A schema-valid RunResponse, optionally overridden per-test. */
function runResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    env: "memory_maze",
    agent: "search_mcts",
    track: "test",
    status: "uploaded",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    metrics: {},
    ...overrides
  };
}

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  const status = init?.status ?? 200;
  const ok = init?.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body))
  } as unknown as Response;
}

function textResponse(text: string, init?: { ok?: boolean; status?: number }) {
  const status = init?.status ?? 200;
  const ok = init?.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    text: async () => text,
    json: async () => JSON.parse(text)
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchJson (via typed wrappers)", () => {
  it("returns parsed JSON on a successful response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [{ id: "t1", description: "d" }] }));

    const result = await fetchTasks();

    expect(result.tasks[0].id).toBe("t1");
    // Server-side getApiBase() defaults to http://localhost:8000 (no window).
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/tasks");
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.cache).toBe("no-store");
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws a status-bearing error on a non-OK response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }));

    await expect(fetchLeaderboard("control")).rejects.toThrow("Request failed (503)");
  });

  it("includes the track query parameter on the leaderboard request", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await fetchLeaderboard("planning");

    expect(fetchMock.mock.calls[0][0]).toContain("/api/leaderboard?track=planning");
  });

  it("maps an AbortError into a friendly timeout message", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abortErr);

    await expect(fetchTasks()).rejects.toThrow("Request timed out while contacting the API");
  });

  it("aborts the request after the 8s timeout fires", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url: string, opts: RequestInit) => {
      capturedSignal = opts.signal as AbortSignal;
      return new Promise(() => {
        /* never resolves; simulates a hanging request */
      });
    });

    const promise = fetchTasks();
    // Avoid an unhandled rejection warning while the promise stays pending.
    promise.catch(() => {});

    expect(capturedSignal?.aborted).toBe(false);
    vi.advanceTimersByTime(8000);
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("propagates non-abort network errors unchanged", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(fetchTasks()).rejects.toThrow("ECONNREFUSED");
  });
});

describe("parseJsonResponse (via createRun)", () => {
  it("returns the parsed body on success", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(runResponse({ id: "run-1", status: "queued" })));

    const result = await createRun({ env: "e", agent: "a", track: "t" }, "key-123");

    expect(result.id).toBe("run-1");
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect((opts.headers as Record<string, string>)["x-api-key"]).toBe("key-123");
    expect(opts.body).toBe(JSON.stringify({ env: "e", agent: "a", track: "t" }));
  });

  it("surfaces the upstream detail message on a non-OK response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "bad api key" }, { ok: false, status: 401 }));

    await expect(createRun({ env: "e", agent: "a", track: "t" }, "nope")).rejects.toThrow("bad api key");
  });

  it("falls back to a generic status message when the error body is not JSON", async () => {
    const broken = {
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      }
    } as unknown as Response;
    fetchMock.mockResolvedValueOnce(broken);

    await expect(createRun({ env: "e", agent: "a", track: "t" }, "k")).rejects.toThrow("Request failed (500)");
  });
});

describe("uploadRunArtifacts", () => {
  it("builds multipart FormData with only provided files and forwards the api key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(runResponse({ id: "run-9", status: "uploaded" })));

    const metricsFile = new File(["{}"], "metrics.json", { type: "application/json" });
    const result = await uploadRunArtifacts("run-9", { metricsFile, traceFile: null, configFile: null }, "k");

    expect(result.id).toBe("run-9");
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect((opts.headers as Record<string, string>)["x-api-key"]).toBe("k");
    const body = opts.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("metrics_file")).toBeInstanceOf(File);
    expect(body.get("trace_file")).toBeNull();
    expect(body.get("config_file")).toBeNull();
  });
});

describe("fetchTrace", () => {
  it("throws when the trace response is not OK", async () => {
    fetchMock.mockResolvedValueOnce(textResponse("", { ok: false, status: 404 }));

    await expect(fetchTrace("missing")).rejects.toThrow("failed to fetch trace");
  });

  it("parses well-formed NDJSON, ignoring blank lines", async () => {
    const ndjson = ['{"steps":[]}', "", '{"steps":[{"t":0}]}', "   "].join("\n");
    fetchMock.mockResolvedValueOnce(textResponse(ndjson));

    const trace = (await fetchTrace("run-1")) as TraceEntry[];

    expect(trace).toHaveLength(2);
    expect(trace[1].steps[0].t).toBe(0);
  });

  it("skips a malformed/truncated NDJSON line instead of throwing (robustness fix)", async () => {
    const ndjson = ['{"steps":[{"t":0}]}', '{"steps":[{"t":1}', '{"steps":[{"t":2}]}'].join("\n");
    fetchMock.mockResolvedValueOnce(textResponse(ndjson));

    const trace = (await fetchTrace("run-1")) as TraceEntry[];

    // The truncated middle line is dropped; the two valid lines survive.
    expect(trace).toHaveLength(2);
    expect(trace.map((e) => e.steps[0].t)).toEqual([0, 2]);
  });
});

describe("parseTraceNdjson", () => {
  it("returns an empty array for empty/whitespace-only input", () => {
    expect(parseTraceNdjson("")).toEqual([]);
    expect(parseTraceNdjson("\n  \n\t")).toEqual([]);
  });

  it("reports malformed lines via the onError callback", () => {
    const onError = vi.fn();
    const result = parseTraceNdjson('{"a":1}\nnot-json\n{"b":2}', onError);

    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe("not-json");
  });
});
