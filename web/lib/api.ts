export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

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

export async function fetchTasks() {
  const res = await fetch(`${API_BASE}/api/tasks`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch tasks");
  }
  return res.json();
}

export async function fetchLeaderboard(track: string) {
  const res = await fetch(`${API_BASE}/api/leaderboard?track=${track}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch leaderboard");
  }
  return (await res.json()) as LeaderboardRow[];
}

export async function fetchRun(runId: string) {
  const res = await fetch(`${API_BASE}/api/runs/${runId}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch run");
  }
  return res.json();
}

export async function fetchTrace(runId: string) {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/trace`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch trace");
  }
  const txt = await res.text();
  return txt
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
