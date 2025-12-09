#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOG_DIR="$REPO_ROOT/.logs"
PID_FILE="$LOG_DIR/next.pid"
LOG_FILE="$LOG_DIR/next.log"

PORT="${PORT:-3100}"

err() { printf "\033[31mERROR:\033[0m %s\n" "$1" >&2; }
warn() { printf "\033[33mWARNING:\033[0m %s\n" "$1" >&2; }
info() { printf "\033[32mINFO:\033[0m %s\n" "$1"; }

command -v pnpm >/dev/null 2>&1 || { err "Missing 'pnpm'. Install with 'corepack enable pnpm' or 'brew install pnpm'."; exit 1; }

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(<"$PID_FILE")"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
    err "Next.js is already running with PID $existing_pid. Use scripts/mac/next_down.sh to stop it first."
    exit 1
  else
    warn "Removing stale PID file at $PID_FILE."
    rm -f "$PID_FILE"
  fi
fi

info "Starting Next.js in the background on port $PORT"
{
  printf "\n[%s] Starting Next.js on port %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$PORT"
} >>"$LOG_FILE"

PORT="$PORT" pnpm run start >>"$LOG_FILE" 2>&1 &
PID=$!
sleep 1
if ! kill -0 "$PID" >/dev/null 2>&1; then
  err "Next.js failed to stay running. Check $LOG_FILE for details."
  exit 1
fi

echo "$PID" >"$PID_FILE"
info "Next.js is running in the background (PID $PID). Logs: $LOG_FILE"
