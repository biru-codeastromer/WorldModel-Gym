#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLYCTL="${FLYCTL:-$HOME/.fly/bin/flyctl}"
API_APP="${API_APP:-worldmodel-gym-api-biru}"
WEB_APP="${WEB_APP:-worldmodel-gym-web-biru}"
REGION="${REGION:-iad}"

if [[ ! -x "$FLYCTL" ]]; then
  echo "flyctl not found at $FLYCTL"
  exit 1
fi

cd "$ROOT_DIR"
mkdir -p .tmp/fly

if ! "$FLYCTL" auth whoami >/dev/null 2>&1; then
  echo "Not authenticated with Fly. Run: $FLYCTL auth login"
  exit 1
fi

ensure_app() {
  local app_name="$1"
  if ! "$FLYCTL" apps list | awk '{print $1}' | grep -qx "$app_name"; then
    "$FLYCTL" apps create "$app_name"
  fi
}

ensure_app "$API_APP"
ensure_app "$WEB_APP"

if ! "$FLYCTL" volumes list -a "$API_APP" | awk 'NR>1{print $1}' | grep -qx "data"; then
  "$FLYCTL" volumes create data --app "$API_APP" --region "$REGION" --size 1
fi

API_TOKEN="$(openssl rand -hex 24)"
"$FLYCTL" secrets set WMG_UPLOAD_TOKEN="$API_TOKEN" --app "$API_APP"

API_TOML=".tmp/fly/api.fly.toml"
WEB_TOML=".tmp/fly/web.fly.toml"
API_BASE="https://${API_APP}.fly.dev"

sed "s/__API_APP__/${API_APP}/g" fly/api.fly.toml.tmpl > "$API_TOML"
sed -e "s/__WEB_APP__/${WEB_APP}/g" -e "s|__API_BASE__|${API_BASE}|g" fly/web.fly.toml.tmpl > "$WEB_TOML"

"$FLYCTL" deploy --config "$API_TOML" --app "$API_APP" --remote-only
"$FLYCTL" deploy --config "$WEB_TOML" --app "$WEB_APP" --remote-only

echo

echo "Fly deployment complete"
echo "API: https://${API_APP}.fly.dev"
echo "WEB: https://${WEB_APP}.fly.dev"
echo "WMG_UPLOAD_TOKEN: $API_TOKEN"
