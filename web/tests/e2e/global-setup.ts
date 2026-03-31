import { execFileSync } from "node:child_process";
import path from "node:path";

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup() {
  const repoRoot = path.resolve(__dirname, "../../..");
  const pythonExecutable = path.resolve(
    repoRoot,
    process.env.WMG_E2E_PYTHON ?? ".venv/bin/python",
  );
  const apiBase = process.env.WMG_E2E_API_BASE ?? "http://127.0.0.1:8100";
  const uploadToken = process.env.WMG_E2E_UPLOAD_TOKEN ?? "e2e-token";

  await waitFor(`${apiBase}/healthz`, 120_000);

  const uniqueSuffix = Date.now().toString(36);
  const runs = [
    {
      runId: `e2e_random_test_${uniqueSuffix}`,
      agent: "random",
      env: "memory_maze",
      track: "test",
    },
    {
      runId: `e2e_oracle_train_${uniqueSuffix}`,
      agent: "greedy_oracle",
      env: "switch_quest",
      track: "train",
    },
  ];

  for (const run of runs) {
    execFileSync(
      pythonExecutable,
      [
        "scripts/demo_run.py",
        "--api-base",
        apiBase,
        "--upload-token",
        uploadToken,
        "--agent",
        run.agent,
        "--env",
        run.env,
        "--track",
        run.track,
        "--run-id",
        run.runId,
      ],
      {
        cwd: repoRoot,
        stdio: "pipe",
      },
    );
  }
}
