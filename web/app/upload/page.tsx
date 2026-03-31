"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

import { RunCreatePayload, RunResponse, createRun, uploadRunArtifacts } from "@/lib/api";

const envOptions = ["memory_maze", "switch_quest", "craft_lite"];
const agentOptions = ["random", "greedy_oracle", "planner_oracle", "imagination_mpc", "search_mcts", "ppo"];
const trackOptions = ["test", "train", "continual"];

function initialValue(param: string | null, fallback: string) {
  return param && param.trim().length > 0 ? param : fallback;
}

function UploadStudio() {
  const searchParams = useSearchParams();
  const [apiKey, setApiKey] = useState("");
  const [form, setForm] = useState<RunCreatePayload>({
    id: "",
    env: initialValue(searchParams.get("env"), "memory_maze"),
    agent: initialValue(searchParams.get("agent"), "search_mcts"),
    track: initialValue(searchParams.get("track"), "test")
  });
  const [metricsFile, setMetricsFile] = useState<File | null>(null);
  const [traceFile, setTraceFile] = useState<File | null>(null);
  const [configFile, setConfigFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);

  const curlSnippet = useMemo(
    () =>
      [
        "curl -X POST https://worldmodel-gym-api.onrender.com/api/runs \\",
        "  -H \"x-api-key: $WMG_API_KEY\" \\",
        "  -H \"Content-Type: application/json\" \\",
        `  -d '{"id":"<optional-run-id>","env":"${form.env}","agent":"${form.agent}","track":"${form.track}"}'`
      ].join("\n"),
    [form.agent, form.env, form.track]
  );

  const pythonSnippet = useMemo(
    () =>
      [
        ".venv/bin/python scripts/demo_run.py \\",
        "  --api-base https://worldmodel-gym-api.onrender.com \\",
        "  --api-key \"$WMG_API_KEY\" \\",
        `  --agent ${form.agent} \\`,
        `  --env ${form.env} \\`,
        `  --track ${form.track}`
      ].join("\n"),
    [form.agent, form.env, form.track]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!apiKey.trim()) {
      setError("A production writer API key is required for browser uploads.");
      return;
    }
    if (!metricsFile) {
      setError("Attach a metrics.json file before publishing a run.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: RunCreatePayload = {
        env: form.env,
        agent: form.agent,
        track: form.track
      };
      if (form.id && form.id.trim()) {
        payload.id = form.id.trim();
      }

      const created = await createRun(payload, apiKey.trim());
      const uploaded = await uploadRunArtifacts(
        created.id,
        {
          metricsFile,
          traceFile,
          configFile
        },
        apiKey.trim()
      );

      setResult(uploaded);
      setForm((current) => ({ ...current, id: uploaded.id }));
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Upload failed while talking to the benchmark API."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-8">
      <section className="border-b border-t border-[var(--line)] py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="section-kicker">Upload studio</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-[var(--ink)]">
              Publish a run through the browser, while keeping API and CLI workflows intact.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">
              Create the run record, attach artifacts, and jump straight into the live leaderboard. If your lab prefers
              scripts, the API and CLI commands stay visible here too.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/leaderboard" className="button-secondary px-5 py-3 text-sm font-semibold">
                Compare Current Runs
              </Link>
              <Link href="/tasks" className="button-secondary px-5 py-3 text-sm font-semibold">
                Browse Benchmark Tasks
              </Link>
            </div>
          </div>

          <div className="site-panel paper-matrix rounded-[30px] p-6">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                "Browser uploads for quick demos",
                "API key auth with live publish",
                "Optional trace and config artifacts",
                "CLI and curl snippets for automation"
              ].map((item) => (
                <div key={item} className="site-soft-panel rounded-[18px] px-4 py-5 text-sm font-medium leading-6 text-[var(--ink)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={handleSubmit} className="site-panel rounded-[30px] p-6 md:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-[var(--ink)]">Writer API Key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="wmg_..."
                className="mt-2 w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--line-strong)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--ink)]">Environment</span>
              <select
                value={form.env}
                onChange={(event) => setForm((current) => ({ ...current, env: event.target.value }))}
                className="mt-2 w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--line-strong)]"
              >
                {envOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--ink)]">Agent</span>
              <select
                value={form.agent}
                onChange={(event) => setForm((current) => ({ ...current, agent: event.target.value }))}
                className="mt-2 w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--line-strong)]"
              >
                {agentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--ink)]">Track</span>
              <select
                value={form.track}
                onChange={(event) => setForm((current) => ({ ...current, track: event.target.value }))}
                className="mt-2 w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--line-strong)]"
              >
                {trackOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--ink)]">Optional Run ID</span>
              <input
                type="text"
                value={form.id ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
                placeholder="Leave blank to auto-generate"
                className="mt-2 w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--line-strong)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--ink)]">Metrics File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => setMetricsFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--ink)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--ink)]">Trace File</span>
              <input
                type="file"
                accept=".jsonl,.txt,application/json"
                onChange={(event) => setTraceFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--ink)]"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-[var(--ink)]">Config File</span>
              <input
                type="file"
                accept=".yaml,.yml,.json,.txt,text/plain,application/json"
                onChange={(event) => setConfigFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--ink)]"
              />
            </label>
          </div>

          {error ? (
            <div className="mt-5 rounded-[18px] border border-[#d8a06f] bg-[#fff0e3] px-4 py-4 text-sm text-[#7a4a24]">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="mt-5 rounded-[18px] border border-[#a6c8a0] bg-[#eef7ea] px-4 py-4 text-sm text-[#355b2f]">
              Run <span className="font-mono">{result.id}</span> published successfully.
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={`/runs/${result.id}`} className="button-primary px-4 py-3 text-sm font-semibold">
                  Open Run Page
                </Link>
                <Link href="/leaderboard" className="button-secondary px-4 py-3 text-sm font-semibold">
                  View Leaderboard
                </Link>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="button-primary px-6 py-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Publishing Run..." : "Create + Upload Run"}
            </button>
            <Link href="/leaderboard" className="button-secondary px-6 py-4 text-sm font-semibold">
              Cancel
            </Link>
          </div>
        </form>

        <div className="space-y-6">
          <div className="site-panel rounded-[30px] p-6">
            <p className="section-kicker">API / CLI</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
              Keep your automation workflows next to the browser upload path.
            </h2>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">curl</p>
                <pre className="mt-2 overflow-x-auto rounded-[18px] border border-[var(--line)] bg-[var(--paper)] p-4 text-xs leading-6 text-[var(--ink)]">
                  {curlSnippet}
                </pre>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">CLI helper</p>
                <pre className="mt-2 overflow-x-auto rounded-[18px] border border-[var(--line)] bg-[var(--paper)] p-4 text-xs leading-6 text-[var(--ink)]">
                  {pythonSnippet}
                </pre>
              </div>
            </div>
          </div>

          <div className="site-soft-panel rounded-[28px] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Upload checklist</p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink)]">
              <li>Use a writer API key with the `runs:write` scope.</li>
              <li>Attach `metrics.json` for every run. Trace and config are optional but recommended.</li>
              <li>Use the optional run ID only if you need deterministic naming from an external pipeline.</li>
              <li>After publish, verify the run on the live leaderboard and open the run detail page.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <section className="site-panel rounded-[30px] p-8">
          <p className="text-sm font-medium text-[var(--muted)]">Loading upload studio...</p>
        </section>
      }
    >
      <UploadStudio />
    </Suspense>
  );
}
