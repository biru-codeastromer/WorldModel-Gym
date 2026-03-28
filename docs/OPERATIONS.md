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
4. Seed demo leaderboard runs when `WMG_SEED_DEMO_DATA=true`.

## Creating Scoped API Keys

```bash
.venv/bin/python -m worldmodel_server.cli create-api-key \
  --name production-writer \
  --scope runs:write
```

The command prints the secret once. Store it in your deployment provider and use it with the `x-api-key` header.

## Monitoring Hooks

- Structured request logs include request IDs, status codes, client IPs, and durations.
- Prometheus metrics are exposed from FastAPI when `WMG_ENABLE_METRICS=true`.
- GitHub Actions runs `Production Smoke` every 6 hours against the public Vercel and Render URLs.

## Local Build Note

If `web/.env.local` was pulled from Vercel CLI, it may contain deployment-only environment variables that interfere with local `next build`. Temporarily move the file aside before building locally:

```bash
mv web/.env.local web/.env.local.bak
cd web && npm run build
mv web/.env.local.bak web/.env.local
```
