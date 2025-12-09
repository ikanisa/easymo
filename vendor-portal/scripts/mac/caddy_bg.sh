#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOG_DIR="$REPO_ROOT/.logs"
PID_FILE="$LOG_DIR/caddy.pid"
LOG_FILE="$LOG_DIR/caddy.log"
DEFAULT_CONFIG="$REPO_ROOT/infra/caddy/Caddyfile"

CONFIG="$DEFAULT_CONFIG"
if [[ -n "${CADDY_CONFIG:-}" ]]; then
  CONFIG="$CADDY_CONFIG"
elif [[ $# -gt 0 ]]; then
  CONFIG="$1"
  shift
fi

err() {
  printf "\033[31mERROR:\033[0m %s\n" "$1" >&2
}

warn() {
  printf "\033[33mWARNING:\033[0m %s\n" "$1" >&2
}

info() {
  printf "\033[32mINFO:\033[0m %s\n" "$1"
}

check_dependency() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Missing dependency: '$cmd'. ${hint}"
    exit 1
  fi
}

check_dependency "caddy" "Install it with 'brew install caddy'."

if [[ ! -f "$CONFIG" ]]; then
  err "Caddy configuration not found at '$CONFIG'. Set CADDY_CONFIG or pass the path as the first argument."
  exit 1
fi

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(<"$PID_FILE")"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
    err "Caddy already appears to be running with PID $existing_pid. Use scripts/mac/caddy_down.sh to stop it first."
    exit 1
  else
    warn "Removing stale PID file at $PID_FILE."
    rm -f "$PID_FILE"
  fi
fi

info "Starting Caddy in the background using $CONFIG"
{
  printf "\n[%s] Starting Caddy with config %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$CONFIG"
} >>"$LOG_FILE"

ADMIN_HOSTNAME="${ADMIN_HOSTNAME:-admin.127.0.0.1.nip.io}" \
  caddy run --config "$CONFIG" "$@" >>"$LOG_FILE" 2>&1 &
PID=$!
sleep 1
if ! kill -0 "$PID" >/dev/null 2>&1; then
  err "Caddy failed to stay running. Check $LOG_FILE for details."
  exit 1
fi

echo "$PID" >"$PID_FILE"
info "Caddy is running in the background (PID $PID). Logs: $LOG_FILE"
