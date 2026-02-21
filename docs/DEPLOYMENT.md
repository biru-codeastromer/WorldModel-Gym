# Deployment

## Recommended Free Cloud Combo: Render (API) + Vercel (Web)

This project supports a fully free setup for hobby usage:
- API on Render free web service
- Next.js web app on Vercel Hobby

### 1) Deploy API on Render

1. Open [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Blueprint**.
3. Connect this repo and deploy using `/render.yaml`.
4. After deploy, copy your API URL (for example `https://worldmodel-gym-api.onrender.com`).

Notes:
- Render free web services can spin down when idle.
- This repo uses sqlite in `/tmp` on Render free tier (ephemeral storage).

### 2) Deploy Web on Vercel

1. Open [Vercel Dashboard](https://vercel.com/new) and import this GitHub repo.
2. Set **Root Directory** to `web`.
3. Add environment variable:
   - `NEXT_PUBLIC_API_BASE=https://<your-render-api-url>`
4. Deploy.

Optional CLI deploy:

```bash
make deploy-vercel
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

Notes:
- URLs are ephemeral and change when restarted.
- Keep your machine running while URLs are in use.

## References

- Render Free tier and pricing: https://render.com/pricing
- Render blueprint spec (`render.yaml`): https://render.com/docs/blueprint-spec
- Vercel plans and Hobby usage: https://vercel.com/pricing
