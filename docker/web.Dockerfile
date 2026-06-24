# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps

WORKDIR /app

COPY web/package.json web/package-lock.json* /app/
RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY web /app

ENV NODE_ENV=production
# next.config.mjs sets `output: 'standalone'`, so this produces
# .next/standalone (a minimal node server + traced deps) and .next/static.
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage: copy only the standalone server output, static assets and
# public files. This avoids shipping the full node_modules tree and keeps the
# image small. Runs as the built-in non-root `node` user.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Public assets (served as-is) and the static chunks the standalone server
# expects under .next/static.
COPY --from=builder /app/public /app/public
COPY --from=builder --chown=node:node /app/.next/standalone /app
COPY --from=builder --chown=node:node /app/.next/static /app/.next/static

USER node

EXPOSE 3000

# The standalone build emits server.js at the app root; it honours PORT/HOSTNAME.
CMD ["node", "server.js"]
