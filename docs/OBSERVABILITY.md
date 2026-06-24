# Observability

This document is the operational contract for monitoring the WorldModel-Gym API:
the structured-log schema, request-id correlation, the Prometheus `/metrics`
endpoint, example dashboards/queries, and the alerting rules.

Operational runbooks (secret rotation, infra topology, verification commands)
live in [`OPERATIONS.md`](./OPERATIONS.md).

## Structured Logs

With `WMG_LOG_JSON=true` (the production default) every log line is a single JSON
object, so Render's log drain and any log pipeline can parse and index it
directly. There are two log streams.

### Access log — `worldmodel_server.access`

Emitted once per HTTP request by the access-log middleware. Schema:

| field         | type   | meaning                                                        |
| ------------- | ------ | -------------------------------------------------------------- |
| `request_id`  | string | 12-char correlation id (see below)                            |
| `method`      | string | HTTP method                                                   |
| `path`        | string | request path (no query string)                               |
| `status_code` | int    | response status (`500` if the handler raised before a response) |
| `duration_ms` | float  | server-side wall-clock latency, rounded to 2 decimals        |
| `client`      | string | client IP (right-most `X-Forwarded-For` hop when `WMG_TRUST_PROXY_HEADERS=true`, else socket peer) |

Example:

```json
{"request_id":"a1b2c3d4e5f6","method":"POST","path":"/api/runs/abc123/upload","status_code":200,"duration_ms":42.17,"client":"203.0.113.7"}
```

### System log — `worldmodel_server.system`

Lifecycle and error events. Every record has an `event` key plus event-specific
fields. No secrets are ever logged. Notable events:

| `event`                          | level   | when                                              |
| -------------------------------- | ------- | ------------------------------------------------- |
| `startup_complete`               | INFO    | app booted; includes storage status + bootstrap state |
| `startup_failed`                 | ERROR   | settings/migrations/storage init failed (with traceback) |
| `shutdown_complete`              | INFO    | clean shutdown, DB pool disposed                  |
| `readiness_failed`               | WARNING | `/readyz` returned 503; includes the failing `checks` |
| `upload_storage_write_failed`    | ERROR   | S3/disk write failed during an upload (→ `502`)   |
| `upload_commit_failed`           | ERROR   | DB commit failed after artifacts written (→ `500`, artifacts rolled back) |
| `upload_artifact_cleanup_failed` | WARNING | best-effort orphan cleanup failed after a rollback |
| `metrics_artifact_read_failed`   | WARNING | transient storage read error; served DB snapshot instead |
| `demo_seed_skipped_in_production`| WARNING | `WMG_SEED_DEMO_DATA` ignored in production         |

Example:

```json
{"event":"upload_storage_write_failed","request_id":"a1b2c3d4e5f6","run_id":"abc123","error":"..."}
```

## Request-ID Correlation

Each request gets a `request_id`:

- Taken from the inbound `X-Request-Id` header if the caller supplies one,
  otherwise a fresh 12-char hex id is generated.
- Echoed back on the response as `x-request-id`.
- Stamped onto the access-log line **and** onto the system-log events emitted
  while handling that request (uploads, storage errors).

To trace a failed upload end to end, grab the `x-request-id` from the client's
response (or the access log) and filter the system stream on it:

```
request_id="a1b2c3d4e5f6"
```

This stitches the access record (`status_code`, `duration_ms`) to any
`upload_storage_write_failed` / `upload_commit_failed` record for the same call.

## Prometheus `/metrics`

When `WMG_ENABLE_METRICS=true` (the production default) the API mounts
`prometheus-fastapi-instrumentator` at `GET /metrics`. `/healthz` and `/readyz`
are excluded from instrumentation so liveness/readiness probes don't pollute
latency histograms.

Exposed series (standard instrumentator names) include:

- `http_requests_total{method,handler,status}` — request counter.
- `http_request_duration_seconds_bucket{handler,...}` — latency histogram.
- `http_request_size_bytes` / `http_response_size_bytes` — payload sizes.
- Default process/runtime collectors (`process_resident_memory_bytes`, etc.).

`/metrics` is unauthenticated and excluded from the OpenAPI schema. In
production, scrape it over Render's private network or place it behind the LB —
do not expose it publicly.

### Example PromQL

Request rate (per handler):

```promql
sum by (handler) (rate(http_requests_total[5m]))
```

5xx error ratio (the primary SLO signal):

```promql
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))
```

p95 latency (seconds):

```promql
histogram_quantile(0.95,
  sum by (le, handler) (rate(http_request_duration_seconds_bucket[5m])))
```

Upload success rate (data-ingestion health):

```promql
sum(rate(http_requests_total{handler="/api/runs/{run_id}/upload",status="200"}[15m]))
  / sum(rate(http_requests_total{handler="/api/runs/{run_id}/upload"}[15m]))
```

## Example Dashboard

A single API dashboard should surface, top to bottom:

1. **Golden signals** — request rate, 5xx error ratio, p50/p95/p99 latency.
2. **Availability** — `up` for the API target; `/readyz` synthetic check status.
3. **Ingestion** — upload rate, upload 5xx/`502` rate, upload p95 latency.
4. **Saturation** — `process_resident_memory_bytes`, CPU, per-replica request
   distribution (to confirm the LB is balancing across replicas).
5. **Dependencies** — Redis queue depth (RQ), Postgres connections, S3 write
   probe outcome (derived from `/readyz` `storage.ok`).

Render's built-in dashboard already plots CPU/memory/restarts per service; the
PromQL panels above complement it with request-level SLOs.

## Alerting Rules

Tune thresholds to your traffic; these are sensible defaults. All are
expressible as Prometheus alerting rules (or as synthetic-probe alerts in your
monitoring stack).

### Error rate (SLO breach)

```yaml
- alert: ApiHighErrorRate
  expr: |
    sum(rate(http_requests_total{status=~"5.."}[5m]))
      / sum(rate(http_requests_total[5m])) > 0.02
  for: 10m
  labels: {severity: page}
  annotations:
    summary: "API 5xx error ratio above 2% for 10m"
```

### Readiness failing (dependency outage)

`/readyz` returns `503` when Postgres or the S3 write-probe is unhealthy, and
logs a `readiness_failed` system event. Alert on the synthetic probe:

```yaml
- alert: ApiNotReady
  expr: probe_success{job="api-readyz"} == 0
  for: 5m
  labels: {severity: page}
  annotations:
    summary: "API /readyz failing — database or storage dependency is down"
```

Equivalently, page on the log stream when `event="readiness_failed"` appears.

### Data-loss conditions (highest severity)

These mean artifacts may be silently lost or unwritable — treat as page-now:

- **S3 write-probe failing** — `/readyz` `storage.ok=false`, or a burst of
  `upload_storage_write_failed` events. The upload path rolls back on write
  failure (returns `502`, no orphaned partial state), so a sustained rate here
  means ingestion is down.

  ```yaml
  - alert: ArtifactWritesFailing
    expr: |
      sum(rate(http_requests_total{handler="/api/runs/{run_id}/upload",status="502"}[10m])) > 0
    for: 10m
    labels: {severity: page}
    annotations:
      summary: "Artifact uploads returning 502 — S3 writes failing"
  ```

- **Upload commit failures** — `upload_commit_failed` events indicate the DB
  rejected metadata after artifacts were written (artifacts are best-effort
  cleaned up). Any sustained rate is a page.

- **Artifact integrity probe failing** — the `Production Smoke` workflow runs
  `verify_deployment.py --check-artifact-integrity` every 6 hours; it fetches a
  real run's metrics/config/trace and asserts they are non-empty and
  schema-plausible. A failing run there means served artifacts are corrupt or
  missing even though the leaderboard returns `200`. Treat a red Production
  Smoke run as a data-integrity incident.

### Queue backlog (worker fell behind)

When `WMG_QUEUE_ENABLED=true`, a growing RQ queue means the worker is down or
under-provisioned and triggered runs are stalling. Alert on queue depth (from an
RQ/Redis exporter):

```yaml
- alert: QueueBacklogGrowing
  expr: rq_jobs{queue="worldmodel-runs",status="queued"} > 50
  for: 15m
  labels: {severity: ticket}
  annotations:
    summary: "RQ queue backlog > 50 for 15m — worker may be stuck or undersized"
```

If you have no RQ exporter, alert on the absence of `worker_run_completed`-style
progress in the worker logs over a rolling window instead.

### Latency (degradation, not outage)

```yaml
- alert: ApiHighLatency
  expr: |
    histogram_quantile(0.95,
      sum by (le) (rate(http_request_duration_seconds_bucket[5m]))) > 1.5
  for: 15m
  labels: {severity: ticket}
  annotations:
    summary: "API p95 latency above 1.5s for 15m"
```
