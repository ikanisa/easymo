#!/usr/bin/env bash
set -euo pipefail

# Helper to launch the Supabase MCP server with repo defaults.
# Requires SUPABASE_MCP_ACCESS_TOKEN (or SUPABASE_ACCESS_TOKEN)
# and SUPABASE_MCP_PROJECT_REF (or VITE_SUPABASE_PROJECT_ID).

PROJECT_REF="${SUPABASE_MCP_PROJECT_REF:-${VITE_SUPABASE_PROJECT_ID:-}}"
ACCESS_TOKEN="${SUPABASE_MCP_ACCESS_TOKEN:-${SUPABASE_ACCESS_TOKEN:-}}"

if [[ -z "${PROJECT_REF}" ]]; then
  echo "Missing project ref. Set SUPABASE_MCP_PROJECT_REF or VITE_SUPABASE_PROJECT_ID." >&2
  exit 1
fi

if [[ -z "${ACCESS_TOKEN}" ]]; then
  echo "Missing access token. Set SUPABASE_MCP_ACCESS_TOKEN or SUPABASE_ACCESS_TOKEN." >&2
  exit 1
fi

ARGS=("--project-ref=${PROJECT_REF}" "--read-only")
if [[ "${SUPABASE_MCP_READ_ONLY:-true}" != "true" ]]; then
  ARGS=("--project-ref=${PROJECT_REF}")
fi

if [[ -n "${SUPABASE_MCP_EXTRA_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA=( ${SUPABASE_MCP_EXTRA_ARGS} )
  ARGS+=("${EXTRA[@]}")
fi

export SUPABASE_ACCESS_TOKEN="${ACCESS_TOKEN}"

exec npx -y @supabase/mcp-server-supabase@latest "${ARGS[@]}"
