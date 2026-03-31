export function getApiBase() {
  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  }
  return "/api/proxy";
}

export type LeaderboardRow = {
  run_id: string;
  env: string;
  agent: string;
  track: string;
  success_rate: number;
  mean_return: number;
  planning_cost_ms_per_step: number;
  created_at: string;
};

export type TaskRecord = {
  id: string;
  description: string;
  defaults?: Record<string, unknown>;
};

export type RunResponse = {
  id: string;
  env: string;
  agent: string;
  track: string;
  status: string;
  created_at: string;
  updated_at: string;
  metrics: Record<string, any>;
  trace_url?: string | null;
  config_url?: string | null;
};

export type RunCreatePayload = {
  id?: string;
  env: string;
  agent: string;
  track: string;
};

async function fetchJson<T>(path: string): Promise<T> {
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
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out while contacting the API");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
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
  return (await res.json()) as T;
}

export async function fetchTasks() {
  return fetchJson<{ tasks: TaskRecord[] }>("/api/tasks");
}

export async function fetchLeaderboard(track: string) {
  return fetchJson<LeaderboardRow[]>(`/api/leaderboard?track=${track}`);
}

export async function fetchRun(runId: string) {
  return fetchJson<RunResponse>(`/api/runs/${runId}`);
}

export async function fetchTrace(runId: string) {
  const res = await fetch(`${getApiBase()}/api/runs/${runId}/trace`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch trace");
  }
  const txt = await res.text();
  return txt
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

  return parseJsonResponse<RunResponse>(res);
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

  return parseJsonResponse<RunResponse>(res);
}
