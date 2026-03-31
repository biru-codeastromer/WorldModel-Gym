"use client";

import Image from "next/image";
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
    <section className="space-y-12 pb-8">
      <section className="grid gap-12 border-b border-[rgba(185,174,195,0.46)] pb-16 pt-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="max-w-xl">
          <p className="section-kicker">Upload studio</p>
          <h1 className="mt-8 font-[var(--font-serif)] text-6xl font-medium leading-[0.92] tracking-[-0.04em] text-[var(--ink)] md:text-7xl">
            Publish real runs from the browser without losing your API and CLI workflow.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
            Create the run record, attach artifacts, and jump into the live leaderboard. If your lab prefers
            automation, the exact curl and CLI path stays visible right beside the form.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/leaderboard" className="button-secondary px-5 py-3 text-sm font-semibold">
              Compare Current Runs
            </Link>
            <Link href="/tasks" className="button-secondary px-5 py-3 text-sm font-semibold">
              Browse Benchmark Tasks
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative aspect-[1/1.02] overflow-hidden rounded-[28px]">
            <Image
              src="/editorial/team-thirdman.jpg"
              alt="Team collaborating over metrics"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 32vw"
            />
          </div>
          <div className="space-y-6">
            <div className="border-t border-[rgba(185,174,195,0.42)] pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">What ships here</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink)]">
                <p>Run metadata creation</p>
                <p>Metrics, trace, and config attachment</p>
                <p>Immediate leaderboard publishing</p>
                <p>Companion API and CLI examples</p>
              </div>
            </div>
            <div className="relative aspect-[1/0.68] overflow-hidden rounded-[26px]">
              <Image
                src="/editorial/chart-rdne.jpg"
                alt="Research chart visual"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 20vw"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-10 xl:grid-cols-[1.04fr_0.96fr]">
        <form onSubmit={handleSubmit} className="rounded-[32px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.78)] px-6 py-8 shadow-[0_22px_54px_rgba(33,24,43,0.06)] md:px-8">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-[var(--ink)]">Writer API Key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="wmg_..."
                className="mt-2 w-full rounded-[18px] border border-[rgba(185,174,195,0.46)] bg-white/90 px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--ink)]">Environment</span>
              <select
                value={form.env}
                onChange={(event) => setForm((current) => ({ ...current, env: event.target.value }))}
                className="mt-2 w-full rounded-[18px] border border-[rgba(185,174,195,0.46)] bg-white/90 px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
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
                className="mt-2 w-full rounded-[18px] border border-[rgba(185,174,195,0.46)] bg-white/90 px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
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
                className="mt-2 w-full rounded-[18px] border border-[rgba(185,174,195,0.46)] bg-white/90 px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
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
                className="mt-2 w-full rounded-[18px] border border-[rgba(185,174,195,0.46)] bg-white/90 px-4 py-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--ink)]">Metrics File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => setMetricsFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-[18px] border border-[rgba(185,174,195,0.46)] bg-white/90 px-4 py-4 text-sm text-[var(--ink)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--ink)]">Trace File</span>
              <input
                type="file"
                accept=".jsonl,.txt,application/json"
                onChange={(event) => setTraceFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-[18px] border border-[rgba(185,174,195,0.46)] bg-white/90 px-4 py-4 text-sm text-[var(--ink)]"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-[var(--ink)]">Config File</span>
              <input
                type="file"
                accept=".yaml,.yml,.json,.txt,text/plain,application/json"
                onChange={(event) => setConfigFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-[18px] border border-[rgba(185,174,195,0.46)] bg-white/90 px-4 py-4 text-sm text-[var(--ink)]"
              />
            </label>
          </div>

          {error ? (
            <div className="mt-5 rounded-[20px] border border-[rgba(216,160,111,0.62)] bg-[#fff0e3] px-4 py-4 text-sm text-[#7a4a24]">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="mt-5 rounded-[20px] border border-[rgba(166,200,160,0.8)] bg-[#eef7ea] px-4 py-4 text-sm text-[#355b2f]">
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

        <div className="space-y-8">
          <div className="rounded-[32px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.72)] px-6 py-8 shadow-[0_18px_48px_rgba(33,24,43,0.06)]">
            <p className="section-kicker">API / CLI</p>
            <h2 className="mt-6 font-[var(--font-serif)] text-4xl leading-[1.04] text-[var(--ink)]">
              Keep automation next to the browser upload path.
            </h2>
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">curl</p>
                <pre className="mt-2 overflow-x-auto rounded-[22px] border border-[rgba(185,174,195,0.42)] bg-[rgba(255,255,255,0.82)] p-4 text-xs leading-6 text-[var(--ink)]">
                  {curlSnippet}
                </pre>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">CLI helper</p>
                <pre className="mt-2 overflow-x-auto rounded-[22px] border border-[rgba(185,174,195,0.42)] bg-[rgba(255,255,255,0.82)] p-4 text-xs leading-6 text-[var(--ink)]">
                  {pythonSnippet}
                </pre>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-[rgba(185,174,195,0.42)] bg-[rgba(241,231,222,0.72)] px-6 py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Upload checklist</p>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--ink)]">
              <li>Use a writer API key with the `runs:write` scope.</li>
              <li>Attach `metrics.json` for every run. Trace and config are optional but recommended.</li>
              <li>Use the optional run ID only if you need deterministic naming from an external pipeline.</li>
              <li>After publish, verify the run on the leaderboard and open the run detail page.</li>
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
        <section className="rounded-[30px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.68)] p-8">
          <p className="text-sm font-medium text-[var(--muted)]">Loading upload studio...</p>
        </section>
      }
    >
      <UploadStudio />
    </Suspense>
  );
}
