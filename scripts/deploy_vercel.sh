#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/web"

echo "Deploying web to Vercel (Hobby)."
echo "If not logged in, this command will open interactive login."

npx vercel --prod
