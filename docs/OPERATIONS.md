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

## Verification Commands

Check the deployed API + web surfaces:

```bash
.venv/bin/python scripts/verify_deployment.py \
  --api-base https://worldmodel-gym-api.onrender.com \
  --web-base https://world-model-gym.vercel.app
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
