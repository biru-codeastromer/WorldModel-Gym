FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY alembic.ini /app/alembic.ini
COPY core /app/core
COPY planners /app/planners
COPY worldmodels /app/worldmodels
COPY agents /app/agents
COPY server /app/server

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -e core -e planners -e worldmodels -e agents -e server

EXPOSE 8000
CMD ["sh", "-c", "uvicorn worldmodel_server.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
