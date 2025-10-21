#!/usr/bin/env bash
set -euo pipefail

# Deploy Supabase Edge Functions.
#
# Usage:
#   PROJECT_REF=xxxx tools/deploy_supabase_functions.sh [--debug] [fn1 fn2 ...]
#
# If no function names are provided, this script discovers functions under
#   - supabase/functions/* (canonical)
# A function directory is considered valid if it contains either an index.ts
# or a function.json file.

DEBUG=""
PRUNE=""
if [[ "${1:-}" == "--debug" ]]; then
  DEBUG=1
  shift || true
fi
if [[ "${1:-}" == "--prune" ]]; then
  PRUNE=1
  shift || true
fi

PROJECT_REF="${PROJECT_REF:-${SUPABASE_PROJECT_REF:-}}"
if [[ -z "$PROJECT_REF" ]]; then
  echo "PROJECT_REF (or SUPABASE_PROJECT_REF) is required" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found in PATH" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

discover_functions() {
  local base="$1"
  if [[ -d "$base" ]]; then
    find "$base" -maxdepth 1 -mindepth 1 -type d \
      -not -name "_shared" -not -name "tests" | while read -r dir; do
      local name
      name="$(basename "$dir")"
      # Skip non-function folders like tests/i18n/utils under wa-webhook
      if [[ -f "$dir/index.ts" || -f "$dir/function.json" ]]; then
        echo "$name"
      fi
    done
  fi
}

# Build function list
if (( "$#" > 0 )); then
  FUNCS="$*"
else
  FUNCS="$(discover_functions "supabase/functions")"
fi

if [[ -z "$FUNCS" ]]; then
  echo "No functions discovered to deploy." >&2
  exit 0
fi

echo "Deploying functions to project: $PROJECT_REF"
idx=0
while read -r fn; do
  [[ -n "$fn" ]] || continue
  idx=$((idx+1))
  echo "→ [$idx] Deploying $fn"
  if [[ -n "$DEBUG" ]]; then
    supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --debug || {
      echo "Deployment failed for $fn" >&2
      exit 1
    }
  else
    supabase functions deploy "$fn" --project-ref "$PROJECT_REF" || {
      echo "Deployment failed for $fn" >&2
      exit 1
    }
  fi
done <<< "$FUNCS"

if [[ -n "$PRUNE" ]]; then
  echo "Pruning remote functions not present locally..."
  supabase functions deploy --project-ref "$PROJECT_REF" --prune ${DEBUG:+--debug}
fi

echo "All functions deployed successfully."
