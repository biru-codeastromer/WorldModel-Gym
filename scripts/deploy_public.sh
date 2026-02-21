#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON="${PYTHON:-.venv/bin/python}"
NPM="${NPM:-npm}"

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

cleanup_pid ".tmp/lt-web.pid"
cleanup_pid ".tmp/lt-api.pid"
cleanup_pid ".tmp/web.pid"
cleanup_pid ".tmp/server.pid"

if [[ ! -x "$PYTHON" ]]; then
  echo "Python venv not found. Run: make setup"
  exit 1
fi

echo "Starting API server on http://127.0.0.1:8000 ..."
nohup "$PYTHON" -m uvicorn worldmodel_server.main:app --host 127.0.0.1 --port 8000 > .tmp/server.log 2>&1 &
echo $! > .tmp/server.pid

for _ in {1..45}; do
  if curl -fsS "http://127.0.0.1:8000/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:8000/healthz" >/dev/null 2>&1; then
  echo "API failed to start; check .tmp/server.log"
  exit 1
fi

echo "Opening public tunnel for API (no account/card required) ..."
nohup npx --yes localtunnel --port 8000 > .tmp/lt-api.log 2>&1 &
echo $! > .tmp/lt-api.pid

API_URL=""
for _ in {1..60}; do
  API_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+' .tmp/lt-api.log | head -n 1 || true)"
  if [[ -n "$API_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$API_URL" ]]; then
  echo "Could not get API tunnel URL; check .tmp/lt-api.log"
  exit 1
fi

echo "Building web with NEXT_PUBLIC_API_BASE=${API_URL} ..."
(
  cd web
  NEXT_PUBLIC_API_BASE="$API_URL" "$NPM" run build >/dev/null
)

echo "Starting web app on http://127.0.0.1:3000 ..."
(
  cd web
  nohup "$NPM" run start -- --hostname 127.0.0.1 --port 3000 > ../.tmp/web.log 2>&1 &
  echo $! > ../.tmp/web.pid
)

for _ in {1..45}; do
  if curl -fsS "http://127.0.0.1:3000" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:3000" >/dev/null 2>&1; then
  echo "Web failed to start; check .tmp/web.log"
  exit 1
fi

echo "Opening public tunnel for web ..."
nohup npx --yes localtunnel --port 3000 > .tmp/lt-web.log 2>&1 &
echo $! > .tmp/lt-web.pid

WEB_URL=""
for _ in {1..60}; do
  WEB_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+' .tmp/lt-web.log | head -n 1 || true)"
  if [[ -n "$WEB_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$WEB_URL" ]]; then
  echo "Could not get web tunnel URL; check .tmp/lt-web.log"
  exit 1
fi

echo "${API_URL}" > .tmp/public-api-url.txt
echo "${WEB_URL}" > .tmp/public-web-url.txt

echo
echo "Public deployment complete (no paid platform required)."
echo "Web URL: ${WEB_URL}"
echo "API URL: ${API_URL}"
echo "PIDs: api=$(cat .tmp/server.pid), web=$(cat .tmp/web.pid), lt-api=$(cat .tmp/lt-api.pid), lt-web=$(cat .tmp/lt-web.pid)"
echo "Use: make stop-public"
