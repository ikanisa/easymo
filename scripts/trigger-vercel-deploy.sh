#!/usr/bin/env bash
set -euo pipefail

URL="${VERCEL_DEPLOY_HOOK_URL:-${VERCEL_DEPLOY_HOOK:-}}"
if [[ -z "${URL}" ]]; then
  echo "VERCEL_DEPLOY_HOOK_URL (or VERCEL_DEPLOY_HOOK) is required" >&2
  exit 1
fi

echo "Triggering Vercel deploy via hook..."
curl -fsS -X POST "${URL}" -H 'Content-Type: application/json' -d '{}' >/dev/null
echo "Deploy hook triggered."

