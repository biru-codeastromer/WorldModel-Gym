# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Builder stage: install only the packages the API actually needs into an
# isolated venv. The API never imports torch, so we deliberately install ONLY
# `core` and `server` (NOT agents/planners/worldmodels, which pull in ~1-2GB of
# torch wheels). The venv is copied wholesale into the slim runtime stage.
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Build venv at a fixed prefix so the runtime stage can copy it verbatim.
ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /build

# Copy only the source the API needs to build/install.
COPY core /build/core
COPY server /build/server

RUN pip install --upgrade pip \
    && pip install ./core ./server

# ---------------------------------------------------------------------------
# Runtime stage: a minimal image that just carries the prebuilt venv plus the
# bits needed at runtime (alembic config + migration scripts). Runs as a
# dedicated non-root user and self-reports health via /healthz.
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# curl is needed by the HEALTHCHECK below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root runtime user.
RUN groupadd --system app && useradd --system --gid app --create-home app

WORKDIR /app

# Copy the prebuilt virtualenv (core + server, no torch).
COPY --from=builder /opt/venv /opt/venv

# Migration assets are needed if WMG_AUTO_MIGRATE is enabled / for the CLI.
COPY alembic.ini /app/alembic.ini
COPY server/alembic /app/server/alembic

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/healthz" || exit 1

CMD ["sh", "-c", "uvicorn worldmodel_server.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
