#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-ezrriefbmhiiqfoxgjgz}"
FUNCTIONS=(
  "wa-webhook"
  "ocr-processor"
  "insurance-ocr"
  "notification-worker"
  "campaign-dispatch"
  "qr_info"
  "qr-resolve"
  "admin-users"
  "admin-settings"
  "admin-stats"
  "admin-trips"
  "admin-subscriptions"
  "admin-messages"
  "media-fetch"
  "housekeeping"
  "flow-exchange"
)

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is not set. Export it before running this script." >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is not installed or not on PATH." >&2
  exit 1
fi

printf 'Deploying %d Supabase Edge Functions to project %s\n\n' "${#FUNCTIONS[@]}" "${PROJECT_REF}"

for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying ${fn}..."
  if supabase functions deploy "${fn}" --project-ref "${PROJECT_REF}" "$@"; then
    echo "✔ ${fn} deployed"
  else
    echo "✖ Failed to deploy ${fn}" >&2
    exit 1
  fi
  echo
  sleep 1
done

echo "All deployments completed."
