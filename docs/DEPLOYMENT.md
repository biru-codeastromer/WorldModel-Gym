# Deployment

## Local Production Mode

Run API + web on your machine:

```bash
make deploy
```

Stop local services:

```bash
make stop
```

## Public No-Card Deployment (Quick Tunnel)

This mode does not require Fly.io, cloud billing, or credit card setup.
It runs services locally and exposes temporary public URLs through `localtunnel`.

```bash
make deploy-public
```

The command will:
- start API (`uvicorn`) on `127.0.0.1:8000`
- create a public API tunnel URL
- build web with `NEXT_PUBLIC_API_BASE=<public-api-url>`
- start web on `127.0.0.1:3000`
- create a public web tunnel URL

Stop public deployment:

```bash
make stop-public
```

Notes:
- Public tunnel URLs are ephemeral and change when restarted.
- Keep your machine running while the public URLs are in use.
