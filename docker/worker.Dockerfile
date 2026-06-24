# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# RQ worker image. Unlike the API, the worker actually RUNS evaluations, so it
# needs the full ML stack: core + server + agents + planners + worldmodels
# (these pull in torch) plus rq for the job queue. Because torch is large we
# still build into an isolated venv in a builder stage and copy it into a slim
# runtime stage to keep the final image as small as the dependency set allows.
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

ENV VIRTUAL_ENV=/opt/venv
RUN python -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /build

# The full source tree the worker needs to run evals.
COPY core /build/core
COPY planners /build/planners
COPY worldmodels /build/worldmodels
COPY agents /build/agents
COPY server /build/server

# `server` already declares redis + rq as dependencies; install it explicitly
# too so the worker stays runnable even if that ever changes.
RUN pip install --upgrade pip \
    && pip install ./core ./planners ./worldmodels ./agents ./server \
    && pip install "rq>=1.16" "redis>=5"

# ---------------------------------------------------------------------------
# Runtime stage.
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# Non-root runtime user.
RUN groupadd --system app && useradd --system --gid app --create-home app

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv

# Migration assets, so the worker can run the CLI / share alembic config.
COPY alembic.ini /app/alembic.ini
COPY server/alembic /app/server/alembic

USER app

# The queue/storage workstream provides the worker entrypoint as a module.
CMD ["python", "-m", "worldmodel_server.worker"]
