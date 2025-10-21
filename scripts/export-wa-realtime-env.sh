#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install jq and retry." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DEFAULT_PROJECT_REF="$(grep -E '^project_id' "${PROJECT_ROOT}/supabase/config.toml" | head -n1 | cut -d'"' -f2)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-${1:-${DEFAULT_PROJECT_REF}}}"
OUTPUT_FILE="${SUPABASE_ENV_OUTPUT:-${2:-${PROJECT_ROOT}/apps/api/.env.bridge}}"

if [[ -z "${PROJECT_REF}" ]]; then
  echo "Unable to determine project ref. Pass SUPABASE_PROJECT_REF or ./scripts/export-wa-realtime-env.sh <project-ref>." >&2
  exit 1
fi

ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [[ -z "${ACCESS_TOKEN}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN not set. Generate a personal access token and export SUPABASE_ACCESS_TOKEN before running." >&2
  exit 1
fi

API_ROOT="https://api.supabase.com"
SECRETS_ENDPOINT="${API_ROOT}/v1/projects/${PROJECT_REF}/functions/secrets"

echo "Fetching secrets for project ${PROJECT_REF}..."
RESPONSE="$(curl -sS -H "Authorization: Bearer ${ACCESS_TOKEN}" "${SECRETS_ENDPOINT}")"

if [[ -z "${RESPONSE}" ]]; then
  echo "Empty response from Supabase secrets endpoint." >&2
  exit 1
fi

if echo "${RESPONSE}" | jq -e 'has("message") and .message == "Unauthorized"' >/dev/null 2>&1; then
  echo "Supabase API returned unauthorized. Confirm the access token has owner permissions." >&2
  exit 1
fi

if echo "${RESPONSE}" | jq -e 'type == "array"' >/dev/null 2>&1; then
  SECRETS_JSON="${RESPONSE}"
else
  SECRETS_JSON="$(echo "${RESPONSE}" | jq '.secrets // []')"
fi

REQUIRED_KEYS=(
  "WABA_ACCESS_TOKEN"
  "WABA_PHONE_NUMBER_ID"
  "WA_VERIFY_TOKEN"
  "WHATSAPP_API_BASE_URL"
  "OPENAI_API_KEY"
  "REALTIME_MODEL"
  "REALTIME_WS_URL"
  "TURN_URIS"
  "TURN_USERNAME"
  "TURN_PASSWORD"
  "REDIS_URL"
)

{
  echo "# Auto-generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "# Source: Supabase function secrets"
} > "${OUTPUT_FILE}"

missing_keys=()
for key in "${REQUIRED_KEYS[@]}"; do
  value="$(echo "${SECRETS_JSON}" | jq -r --arg KEY "${key}" '
    [ .. | objects | select(.name? == $KEY) | .value | select(. != null) ][0] // empty
  ')"

  if [[ -z "${value}" || "${value}" == "null" ]]; then
    missing_keys+=("${key}")
    continue
  fi

  printf 'export %s=%q\n' "${key}" "${value}" >> "${OUTPUT_FILE}"
  done

  echo "" >> "${OUTPUT_FILE}"
  if [[ "${#missing_keys[@]}" -gt 0 ]]; then
    {
      echo "# Missing keys:"
      for key in "${missing_keys[@]}"; do
        echo "# - ${key}"
      done
    } >> "${OUTPUT_FILE}"
  fi

  cat <<INFO
Secrets written to ${OUTPUT_FILE}

To load them into your shell:
  source ${OUTPUT_FILE}

Missing keys (if any) are listed at the bottom of the file.
INFO
