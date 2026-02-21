#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON="${PYTHON:-.venv/bin/python}"
NEXT_CMD="${NEXT_CMD:-npm}"

mkdir -p .tmp

cleanup_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$pid_file"
  fi
}

cleanup_pid ".tmp/server.pid"
cleanup_pid ".tmp/web.pid"

echo "Starting API server on http://127.0.0.1:8000 ..."
nohup "$PYTHON" -m uvicorn worldmodel_server.main:app --host 127.0.0.1 --port 8000 > .tmp/server.log 2>&1 &
echo $! > .tmp/server.pid

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:8000/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:8000/healthz" >/dev/null 2>&1; then
  echo "API failed to start; check .tmp/server.log"
  exit 1
fi

echo "Building web app..."
(
  cd web
  "$NEXT_CMD" run build >/dev/null
)

echo "Starting web app on http://127.0.0.1:3000 ..."
(
  cd web
  nohup "$NEXT_CMD" run start -- --hostname 127.0.0.1 --port 3000 > ../.tmp/web.log 2>&1 &
  echo $! > ../.tmp/web.pid
)

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:3000" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:3000" >/dev/null 2>&1; then
  echo "Web failed to start; check .tmp/web.log"
  exit 1
fi

echo "Deployment complete."
echo "API: http://127.0.0.1:8000"
echo "Web: http://127.0.0.1:3000"
echo "PIDs: server=$(cat .tmp/server.pid), web=$(cat .tmp/web.pid)"
