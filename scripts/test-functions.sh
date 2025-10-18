#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "SUPABASE_URL is not set. Export it before running." >&2
  exit 1
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is not set. Export the service-role key." >&2
  exit 1
fi

if [[ -z "${EASYMO_ADMIN_TOKEN:-}" ]]; then
  echo "EASYMO_ADMIN_TOKEN is not set. Export the admin token used by edge functions." >&2
  exit 1
fi

BASE_URL="${SUPABASE_URL%/}/functions/v1"
AUTH_HEADER="Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

call_get() {
  local slug="$1"
  local header="$2"
  echo
  echo "-- ${slug}"
  curl -s -w "\nHTTP:%{http_code}\n" \
    -H "${AUTH_HEADER}" \
    -H "${header}" \
    "${BASE_URL}/${slug}"
}

call_get "admin-health" "x-admin-token: ${EASYMO_ADMIN_TOKEN}"
call_get "admin-settings" "x-api-key: ${EASYMO_ADMIN_TOKEN}"
call_get "admin-stats" "x-api-key: ${EASYMO_ADMIN_TOKEN}"
call_get "admin-users" "x-api-key: ${EASYMO_ADMIN_TOKEN}"
call_get "admin-subscriptions" "x-api-key: ${EASYMO_ADMIN_TOKEN}"
call_get "admin-trips" "x-api-key: ${EASYMO_ADMIN_TOKEN}"
call_get "campaign-dispatch?action=status" "x-admin-token: ${EASYMO_ADMIN_TOKEN}"
