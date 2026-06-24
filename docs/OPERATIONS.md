# Operations

## Health Endpoints

- API liveness: `/healthz`
- API readiness: `/readyz`
- API metrics: `/metrics`
- Web smoke path: `/api/proxy/api/leaderboard?track=test`

## Startup Flow

1. Validate production settings.
2. Run Alembic migrations when `WMG_AUTO_MIGRATE=true`.
3. Initialize the configured artifact store.
4. Optionally bootstrap the first admin/writer key when `WMG_BOOTSTRAP_API_KEY` is set and no API keys exist yet.
5. Seed demo leaderboard runs when `WMG_SEED_DEMO_DATA=true`.

## Creating Scoped API Keys

```bash
.venv/bin/python -m worldmodel_server.cli create-api-key \
  --name production-writer \
  --scope runs:write
```

The command prints the secret once. Store it in your deployment provider and use it with the `x-api-key` header.

If you use `WMG_BOOTSTRAP_API_KEY`, remove it after the first durable writer key is created.

## Monitoring Hooks

- Structured request logs include request IDs, status codes, client IPs, and durations.
- Structured system logs emit startup and readiness events without printing secrets.
- Prometheus metrics are exposed from FastAPI when `WMG_ENABLE_METRICS=true`.
- GitHub Actions runs `Production Smoke` every 6 hours against the public Vercel and Render URLs.

See [`OBSERVABILITY.md`](./OBSERVABILITY.md) for the full log schema, request-id
correlation, the `/metrics` scrape contract, example dashboards/queries, and the
concrete alerting rules.

## Infrastructure Topology (Render)

`render.yaml` declares the full production topology as IaC:

- **`worldmodel-gym-api`** (`type: web`, Docker) — stateless FastAPI service.
  Stateless because run metadata lives in Postgres, artifacts in S3, and the
  rate limiter + queue state in Redis. It can therefore run multiple replicas.
  `plan: free` is a single sleeping instance; to scale horizontally, upgrade to a
  paid plan and uncomment the `numInstances`/`scaling` block in `render.yaml`.
  Migrations run once via `preDeployCommand` (with `WMG_AUTO_MIGRATE=false`) so
  replicas never race to migrate.
- **`worldmodel-gym-worker`** (`type: worker`, Docker) — drains the RQ queue and
  runs evaluations; never serves HTTP.
- **`worldmodel-gym-redis`** (`type: keyvalue`, `noeviction`) — RQ broker and the
  shared rate-limiter backend.
- **`worldmodel-gym-db`** (`databases:`, managed Postgres) — single source of
  truth for run metadata, API keys, and leaderboard ranking columns. The API and
  worker receive `WMG_DB_URL` via `fromDatabase` (no credential in git).
- **S3-compatible object storage** — artifacts (`metrics.json`, `trace.jsonl`,
  `config.yaml`). The container filesystem is ephemeral, so there is no
  persistent disk: production is S3-only by design, and the API refuses to start
  with `WMG_STORAGE_BACKEND=local` in production.

What still requires out-of-band setup (cannot be expressed in `render.yaml`):

- The S3 bucket, IAM/access keys, and `WMG_S3_*` secrets (set `sync:false` in the
  dashboard).
- Enabling Postgres automated backups / PITR and choosing the paid plan tier.
- Log drains / metrics scraping targets and the alerting rules in
  [`OBSERVABILITY.md`](./OBSERVABILITY.md) — these live in your monitoring stack
  (Grafana/Prometheus/Render dashboards), not in `render.yaml`.

## Secret Rotation Runbook

All rotations are zero-downtime when the API runs multiple replicas: add the new
credential, roll the service, then retire the old one.

### Rotate an API key

API keys are scoped, hashed-at-rest credentials. Rotation is create-new /
retire-old (never edit in place):

```bash
# 1. Mint a replacement key with the same scopes.
.venv/bin/python -m worldmodel_server.cli create-api-key \
  --name production-writer-2026q3 \
  --scope runs:write

# 2. Distribute the printed secret to the client(s) and confirm traffic shifts
#    to the new key (the access log records the principal identifier).
# 3. Retire the old key. Use the CLI's revoke command if available in your
#    build, otherwise delete the api_keys row for the old prefix:
#      DELETE FROM api_keys WHERE key_prefix = '<old-prefix>';
```

The secret is printed exactly once at creation; it is never recoverable
afterward (only the hash is stored). If a key is lost, rotate rather than
attempting recovery.

### Retire the bootstrap key

`WMG_BOOTSTRAP_API_KEY` (`generateValue: true` in `render.yaml`) is a one-time
seed for the very first admin/writer key when the `api_keys` table is empty.
Once a durable key exists, retire it:

1. Confirm a durable writer/admin key has been created and is in use.
2. Remove the `WMG_BOOTSTRAP_API_KEY` env var from the Render dashboard (and the
   `generateValue` block from `render.yaml`).
3. Redeploy. On the next boot `ensure_bootstrap_api_key` is a no-op because keys
   already exist, and `/readyz` reports `bootstrap_api_key_configured: false`.

### Rotate S3 credentials

1. Create a new IAM access key pair scoped to the artifact bucket.
2. Update `WMG_S3_ACCESS_KEY_ID` / `WMG_S3_SECRET_ACCESS_KEY` in the Render
   dashboard for **both** the `api` and `worker` services.
3. Redeploy; `/readyz` runs a live S3 write-probe, so a bad credential surfaces
   as a `503` readiness failure rather than silent data loss.
4. Disable/delete the old IAM key after readiness is green on all replicas.

### Rotate the database credentials

1. Rotate the Postgres password in the Render dashboard (or create a new managed
   instance and dump/restore for a full credential turnover).
2. Because `WMG_DB_URL` is wired via `fromDatabase`, Render re-injects the new
   connection string on redeploy — no manual env edit needed.
3. Redeploy the API and worker; verify `/readyz` `database.ok: true`.

## Verification Commands

Check the deployed API + web surfaces:

```bash
.venv/bin/python scripts/verify_deployment.py \
  --api-base https://worldmodel-gym-api.onrender.com \
  --web-base https://world-model-gym.vercel.app
```

Add `--check-artifact-integrity` to go beyond HTTP 200s and assert that a real
run's `metrics`/`config`/`trace` artifacts are non-empty and schema-plausible
(picks the top leaderboard run, or pass `--run-id <id>` to target one). The
`Production Smoke` workflow runs this check every 6 hours:

```bash
.venv/bin/python scripts/verify_deployment.py \
  --api-base https://worldmodel-gym-api.onrender.com \
  --check-artifact-integrity
```

Create and upload a demo run:

```bash
.venv/bin/python scripts/demo_run.py \
  --api-base https://worldmodel-gym-api.onrender.com \
  --api-key "$WMG_API_KEY"
```

## Local Build Note

If `web/.env.local` was pulled from Vercel CLI, it may contain deployment-only environment variables that interfere with local `next build`. Temporarily move the file aside before building locally:

```bash
mv web/.env.local web/.env.local.bak
cd web && npm run build
mv web/.env.local.bak web/.env.local
```
