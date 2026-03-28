import path from "node:path";

import { defineConfig } from "@playwright/test";

const repoRoot = path.resolve(__dirname, "..");
const pythonExecutable = process.env.WMG_E2E_PYTHON ?? ".venv/bin/python";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: `${pythonExecutable} -m uvicorn worldmodel_server.main:app --host 127.0.0.1 --port 8100`,
      cwd: repoRoot,
      env: {
        WMG_DB_URL: "sqlite:///./.tmp/e2e.db",
        WMG_STORAGE_DIR: "./.tmp/e2e-storage",
        WMG_UPLOAD_TOKEN: "e2e-token",
        WMG_AUTO_MIGRATE: "true",
        WMG_ENABLE_METRICS: "false",
        WMG_SEED_DEMO_DATA: "true"
      },
      url: "http://127.0.0.1:8100/healthz",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      cwd: path.resolve(repoRoot, "web"),
      env: {
        INTERNAL_API_BASE: "http://127.0.0.1:8100",
        NEXT_PUBLIC_API_BASE: "http://127.0.0.1:8100"
      },
      url: "http://127.0.0.1:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
