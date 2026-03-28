# Deployment

Before deploying, set environment variables directly in Render/Vercel or in your shell. Do not commit env files to the repository.

## Recommended Production Combo: Render (API) + Vercel (Web)

This repo now supports a more production-ready topology:

- API on Render via `render.yaml`
- managed Postgres provisioned from the same Render blueprint
- optional S3-compatible artifact storage
- Next.js web app on Vercel with same-origin proxying for browser requests

### 1) Deploy API on Render

1. Open [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Blueprint**.
3. Connect this repo and deploy using `/render.yaml`.
4. After deploy, copy your API URL (for example `https://worldmodel-gym-api.onrender.com`).
5. Create a scoped writer key:

```bash
.venv/bin/python -m worldmodel_server.cli create-api-key \
  --name production-writer \
  --scope runs:write
```

6. Store that secret in your submission workflow or benchmark runner.

Notes:
- `render.yaml` provisions Postgres and enables migrations plus seeded demo runs.
- `WMG_DB_URL` is normalized automatically for SQLAlchemy when Render injects a Postgres connection string.
- For real artifact durability, switch to `WMG_STORAGE_BACKEND=s3` and provide the S3-compatible bucket credentials below.

### Optional: enable S3-compatible artifact storage

Add these Render environment variables:

- `WMG_STORAGE_BACKEND=s3`
- `WMG_S3_BUCKET=<bucket-name>`
- `WMG_S3_REGION=<region>`
- `WMG_S3_ENDPOINT_URL=<endpoint-url>` if using Cloudflare R2, MinIO, or another S3-compatible endpoint
- `WMG_S3_ACCESS_KEY_ID=<access-key>`
- `WMG_S3_SECRET_ACCESS_KEY=<secret-key>`
- `WMG_S3_PREFIX=runs`

### 2) Deploy Web on Vercel

1. Open [Vercel Dashboard](https://vercel.com/new) and import this GitHub repo.
2. Set **Root Directory** to `web`.
3. Add environment variable:
   - `NEXT_PUBLIC_API_BASE=https://<your-render-api-url>`
   - `INTERNAL_API_BASE=https://<your-render-api-url>`
4. Deploy.

Optional CLI deploy:

```bash
make deploy-vercel
```

If you previously pulled `web/.env.local` from Vercel CLI, move it aside before running a local production build because it may contain deployment-only values:

```bash
mv web/.env.local web/.env.local.bak
cd web && npm run build
mv web/.env.local.bak web/.env.local
```

## Local Production Mode

Run API + web on your machine:

```bash
make deploy
```

Stop local services:

```bash
make stop
```

## Public No-Card Tunnel Mode

This mode does not require cloud accounts or credit card setup.
It runs services locally and exposes temporary public URLs through `localtunnel`.

```bash
make deploy-public
```

Stop:

```bash
make stop-public
```

## Health Checks

- Liveness: `/healthz`
- Readiness: `/readyz`
- Metrics: `/metrics`

## References

- Render Free tier and pricing: https://render.com/pricing
- Render blueprint spec (`render.yaml`): https://render.com/docs/blueprint-spec
- Vercel plans and Hobby usage: https://vercel.com/pricing
