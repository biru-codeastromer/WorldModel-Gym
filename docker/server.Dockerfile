FROM python:3.11-slim

WORKDIR /app

COPY requirements-dev.txt /app/requirements-dev.txt
COPY core /app/core
COPY planners /app/planners
COPY worldmodels /app/worldmodels
COPY agents /app/agents
COPY server /app/server

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements-dev.txt \
    && pip install --no-cache-dir -e core -e planners -e worldmodels -e agents -e server

EXPOSE 8000
CMD ["uvicorn", "worldmodel_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
