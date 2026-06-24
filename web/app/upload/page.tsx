"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  Suspense,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileCog,
  FileJson,
  FileText,
  KeyRound,
  Layers,
  Sparkles,
  Tag,
  Trash2,
  Trophy,
  UploadCloud
} from "lucide-react";

import { RunCreatePayload, RunResponse, createRun, uploadRunArtifacts } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  Section,
  SectionHeader,
  Skeleton,
  cn
} from "@/components/ui";
import { Reveal, useHoverLift } from "@/components/motion";
import { GridWorld, PlannerTree } from "@/components/visuals";

const envOptions = ["memory_maze", "switch_quest", "craft_lite"];
const agentOptions = ["random", "greedy_oracle", "planner_oracle", "imagination_mpc", "search_mcts", "ppo"];
const trackOptions = ["test", "train", "continual"];

type SlotKey = "metrics" | "trace" | "config";

const slotConfig: Record<
  SlotKey,
  {
    label: string;
    hint: string;
    accept: string;
    required: boolean;
    Icon: typeof FileJson;
    inputId: string;
    name: string;
  }
> = {
  metrics: {
    label: "Metrics",
    hint: "metrics.json — required",
    accept: ".json,application/json",
    required: true,
    Icon: FileJson,
    inputId: "upload-metrics-file",
    name: "metrics-file"
  },
  trace: {
    label: "Trace",
    hint: "trace.jsonl — optional",
    accept: ".jsonl,.txt,application/json",
    required: false,
    Icon: FileText,
    inputId: "upload-trace-file",
    name: "trace-file"
  },
  config: {
    label: "Config",
    hint: "config.yaml — optional",
    accept: ".yaml,.yml,.json,.txt,text/plain,application/json",
    required: false,
    Icon: FileCog,
    inputId: "upload-config-file",
    name: "config-file"
  }
};

function initialValue(param: string | null, fallback: string) {
  return param && param.trim().length > 0 ? param : fallback;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** A single accessible labelled select built from theme tokens. */
function SelectField({
  id,
  name,
  label,
  Icon,
  value,
  options,
  onChange
}: {
  id: string;
  name: string;
  label: string;
  Icon: typeof Tag;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="flex items-center gap-2 font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-fg-muted">
        <Icon className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
        {label}
      </span>
      <select
        id={id}
        name={name}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full appearance-none rounded-md border border-border bg-surface-2 px-3.5 py-3 font-mono text-sm text-fg outline-none transition-colors hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A drag-and-drop dropzone for one artifact slot. */
function Dropzone({
  slot,
  file,
  invalid,
  onFile,
  onRemove
}: {
  slot: SlotKey;
  file: File | null;
  invalid: boolean;
  onFile: (file: File | null) => void;
  onRemove: () => void;
}) {
  const cfg = slotConfig[slot];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const { Icon } = cfg;

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) onFile(dropped);
    },
    [onFile]
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  return (
    <div>
      <span className="flex items-center justify-between font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-fg-muted">
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
          {cfg.label}
        </span>
        {cfg.required ? (
          <Badge tone="accent" variant="outline">
            Required
          </Badge>
        ) : (
          <Badge tone="neutral" variant="outline">
            Optional
          </Badge>
        )}
      </span>

      <input
        ref={inputRef}
        id={cfg.inputId}
        name={cfg.name}
        type="file"
        accept={cfg.accept}
        className="sr-only"
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onFile(event.target.files?.[0] ?? null)
        }
      />

      {file ? (
        <div
          className={cn(
            "mt-2 flex items-center gap-3 rounded-md border bg-surface-2 px-3.5 py-3",
            "border-success/45"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-success-soft text-success">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-sm text-fg">{file.name}</span>
            <span className="block font-mono text-[0.7rem] text-fg-subtle">
              {formatBytes(file.size)}
            </span>
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${cfg.label} file ${file.name}`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Upload ${cfg.label} file. ${cfg.hint}. Drag and drop or activate to browse.${invalid ? " This file is required." : ""}`}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
            dragOver
              ? "border-accent bg-accent-soft"
              : invalid
                ? "border-danger/60 bg-danger-soft/40"
                : "border-border-strong bg-surface-2 hover:border-accent hover:bg-accent-soft/50"
          )}
        >
          <UploadCloud
            className={cn("h-5 w-5", dragOver ? "text-accent" : "text-fg-subtle")}
            aria-hidden="true"
          />
          <span className="font-mono text-xs text-fg-muted">
            Drop file or <span className="text-accent">browse</span>
          </span>
          <span className="font-mono text-[0.68rem] text-fg-subtle">{cfg.hint}</span>
        </div>
      )}
    </div>
  );
}

/** A copyable code snippet block. */
function Snippet({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [code]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-fg-muted">
          {label}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copy}
          leftIcon={
            copied ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )
          }
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-border bg-surface-2 p-3.5 font-mono text-xs leading-6 text-fg">
        {code}
      </pre>
    </div>
  );
}

function UploadStudio() {
  const searchParams = useSearchParams();
  const liftPrimary = useHoverLift(2);
  const errorRegionId = useId();

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
  const [touched, setTouched] = useState(false);

  const fileFor = (slot: SlotKey) =>
    slot === "metrics" ? metricsFile : slot === "trace" ? traceFile : configFile;
  const setFileFor = (slot: SlotKey, file: File | null) => {
    if (slot === "metrics") setMetricsFile(file);
    else if (slot === "trace") setTraceFile(file);
    else setConfigFile(file);
  };

  const keyMissing = touched && apiKey.trim().length === 0;
  const metricsMissing = touched && !metricsFile;
  const attachedCount = [metricsFile, traceFile, configFile].filter(Boolean).length;
  const readyToPublish = apiKey.trim().length > 0 && Boolean(metricsFile);

  const curlSnippet = useMemo(
    () =>
      [
        "curl -X POST https://worldmodel-gym-api.onrender.com/api/runs \\",
        '  -H "x-api-key: $WMG_API_KEY" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '{"id":"<optional-run-id>","env":"${form.env}","agent":"${form.agent}","track":"${form.track}"}'`
      ].join("\n"),
    [form.agent, form.env, form.track]
  );

  const pythonSnippet = useMemo(
    () =>
      [
        ".venv/bin/python scripts/demo_run.py \\",
        "  --api-base https://worldmodel-gym-api.onrender.com \\",
        '  --api-key "$WMG_API_KEY" \\',
        `  --agent ${form.agent} \\`,
        `  --env ${form.env} \\`,
        `  --track ${form.track}`
      ].join("\n"),
    [form.agent, form.env, form.track]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
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
    <Section className="!pt-2 !pb-8">
      {/* Compact hero */}
      <Reveal>
        <div className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-accent">
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              Submission studio
            </p>
            <h1 className="font-serif text-3xl leading-[1.08] tracking-[-0.01em] text-fg md:text-4xl">
              Publish a run to the leaderboard
            </h1>
            <p className="mt-3 max-w-xl font-mono text-sm leading-7 text-fg-muted">
              Create the run record, attach artifacts, and ship it live — without
              leaving your API or CLI workflow.
            </p>
          </div>
          <div
            aria-hidden="true"
            className="hidden shrink-0 items-center gap-4 md:flex"
          >
            <GridWorld size={5} className="h-20 w-20" />
            <PlannerTree className="h-20 w-28" />
          </div>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left: the guided form */}
        <div className="min-w-0">
          <Reveal direction="up" delay={0.05}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1 — credentials */}
              <Card elevation="raised" padding="lg">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">
                    1
                  </span>
                  <h2 className="font-serif text-xl text-fg">Authenticate</h2>
                </div>
                <label htmlFor="upload-api-key" className="block">
                  <span className="flex items-center gap-2 font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-fg-muted">
                    <KeyRound className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
                    Writer API key
                  </span>
                  <input
                    id="upload-api-key"
                    name="api-key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="wmg_..."
                    aria-invalid={keyMissing || undefined}
                    aria-describedby={keyMissing ? `${errorRegionId}-key` : undefined}
                    className={cn(
                      "mt-2 w-full rounded-md border bg-surface-2 px-3.5 py-3 font-mono text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
                      keyMissing ? "border-danger/60" : "border-border hover:border-border-strong"
                    )}
                  />
                  {keyMissing ? (
                    <span
                      id={`${errorRegionId}-key`}
                      className="mt-1.5 flex items-center gap-1.5 font-mono text-[0.7rem] text-danger"
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      A writer key with the runs:write scope is required.
                    </span>
                  ) : (
                    <span className="mt-1.5 block font-mono text-[0.7rem] text-fg-subtle">
                      Stays in the browser. Used only for this request.
                    </span>
                  )}
                </label>
              </Card>

              {/* Step 2 — run metadata */}
              <Card elevation="raised" padding="lg">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">
                    2
                  </span>
                  <h2 className="font-serif text-xl text-fg">Describe the run</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    id="upload-env"
                    name="env"
                    label="Environment"
                    Icon={Layers}
                    value={form.env}
                    options={envOptions}
                    onChange={(value) => setForm((current) => ({ ...current, env: value }))}
                  />
                  <SelectField
                    id="upload-agent"
                    name="agent"
                    label="Agent"
                    Icon={Sparkles}
                    value={form.agent}
                    options={agentOptions}
                    onChange={(value) => setForm((current) => ({ ...current, agent: value }))}
                  />
                  <SelectField
                    id="upload-track"
                    name="track"
                    label="Track"
                    Icon={Tag}
                    value={form.track}
                    options={trackOptions}
                    onChange={(value) => setForm((current) => ({ ...current, track: value }))}
                  />
                  <label htmlFor="upload-run-id" className="block">
                    <span className="flex items-center gap-2 font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-fg-muted">
                      <Tag className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
                      Optional run ID
                    </span>
                    <input
                      id="upload-run-id"
                      name="run-id"
                      type="text"
                      autoComplete="off"
                      value={form.id ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, id: event.target.value }))
                      }
                      placeholder="auto-generate"
                      className="mt-2 w-full rounded-md border border-border bg-surface-2 px-3.5 py-3 font-mono text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                    />
                  </label>
                </div>
              </Card>

              {/* Step 3 — artifacts */}
              <Card elevation="raised" padding="lg">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">
                    3
                  </span>
                  <h2 className="font-serif text-xl text-fg">Attach artifacts</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {(Object.keys(slotConfig) as SlotKey[]).map((slot) => (
                    <Dropzone
                      key={slot}
                      slot={slot}
                      file={fileFor(slot)}
                      invalid={slot === "metrics" && metricsMissing}
                      onFile={(file) => setFileFor(slot, file)}
                      onRemove={() => setFileFor(slot, null)}
                    />
                  ))}
                </div>
                {metricsMissing ? (
                  <p className="mt-3 flex items-center gap-1.5 font-mono text-[0.7rem] text-danger">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    A metrics.json file is required to publish a run.
                  </p>
                ) : null}
              </Card>

              {/* Live status region */}
              <div aria-live="polite" aria-atomic="true">
                {error ? (
                  <Reveal direction="none">
                    <div
                      role="alert"
                      className="flex items-start gap-3 rounded-md border border-danger/45 bg-danger-soft px-4 py-3.5"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-danger"
                        aria-hidden="true"
                      />
                      <p className="font-mono text-sm leading-6 text-danger">{error}</p>
                    </div>
                  </Reveal>
                ) : null}

                {result ? (
                  <Reveal direction="up">
                    <Card elevation="pop" padding="lg" className="border-success/45">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-serif text-xl text-fg">Run published</h3>
                          <p className="mt-1 font-mono text-sm text-fg-muted">
                            Run{" "}
                            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-fg">
                              {result.id}
                            </span>{" "}
                            is now live on the leaderboard.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <Link href={`/runs/${result.id}`}>
                              <Button
                                variant="primary"
                                size="sm"
                                rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                              >
                                Open run page
                              </Button>
                            </Link>
                            <Link href="/leaderboard">
                              <Button variant="secondary" size="sm" leftIcon={<Trophy className="h-4 w-4" aria-hidden="true" />}>
                                View leaderboard
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Reveal>
                ) : null}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  size="lg"
                  loading={submitting}
                  disabled={submitting}
                  leftIcon={!submitting ? <UploadCloud className="h-4 w-4" aria-hidden="true" /> : undefined}
                  {...liftPrimary}
                >
                  {submitting ? "Publishing run…" : "Create + upload run"}
                </Button>
                <Link href="/leaderboard">
                  <Button type="button" variant="ghost" size="lg">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </Reveal>
        </div>

        {/* Right: sticky summary + automation */}
        <div className="min-w-0">
          <div className="space-y-6 lg:sticky lg:top-[124px]">
            <Reveal direction="up" delay={0.1}>
              <Card elevation="raised" padding="lg">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl text-fg">Submission preview</h2>
                  <Badge tone={readyToPublish ? "success" : "neutral"}>
                    {readyToPublish ? "Ready" : "Incomplete"}
                  </Badge>
                </div>

                <dl className="mt-5 space-y-px overflow-hidden rounded-md border border-border">
                  {[
                    { term: "Environment", value: form.env, tone: "accent" as const },
                    { term: "Agent", value: form.agent, tone: "accent" as const },
                    { term: "Track", value: form.track, tone: "neutral" as const },
                    {
                      term: "Run ID",
                      value: form.id?.trim() ? form.id.trim() : "auto-generated",
                      tone: "neutral" as const
                    }
                  ].map((row) => (
                    <div
                      key={row.term}
                      className="flex items-center justify-between gap-3 bg-surface-2 px-3.5 py-2.5"
                    >
                      <dt className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-fg-subtle">
                        {row.term}
                      </dt>
                      <dd className="min-w-0 truncate">
                        <Badge tone={row.tone}>{row.value}</Badge>
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-fg-subtle">
                    Artifacts {attachedCount}/3
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {(Object.keys(slotConfig) as SlotKey[]).map((slot) => {
                      const file = fileFor(slot);
                      const cfg = slotConfig[slot];
                      return (
                        <li
                          key={slot}
                          className="flex items-center justify-between gap-2 font-mono text-xs"
                        >
                          <span className="flex items-center gap-2 text-fg-muted">
                            <cfg.Icon className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
                            {cfg.label}
                          </span>
                          {file ? (
                            <span className="flex items-center gap-1.5 text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatBytes(file.size)}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">
                              {cfg.required ? "missing" : "—"}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {submitting ? (
                  <div className="mt-5 space-y-2" aria-hidden="true">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ) : null}
              </Card>
            </Reveal>

            <Reveal direction="up" delay={0.15}>
              <Card elevation="raised" padding="lg">
                <SectionHeader
                  as="h2"
                  kicker="API / CLI"
                  title="Automate it"
                  lede="The same submission, scripted. Field values update live."
                />
                <div className="mt-5 space-y-4">
                  <Snippet label="curl" code={curlSnippet} />
                  <Snippet label="CLI helper" code={pythonSnippet} />
                </div>
              </Card>
            </Reveal>
          </div>
        </div>
      </div>
    </Section>
  );
}

function StudioFallback() {
  return (
    <Section className="!pt-2 !pb-8">
      <div className="space-y-3 border-b border-border pb-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </Section>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<StudioFallback />}>
      <UploadStudio />
    </Suspense>
  );
}
