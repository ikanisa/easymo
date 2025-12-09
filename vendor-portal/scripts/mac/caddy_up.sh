#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOG_DIR="$REPO_ROOT/.logs"
PID_FILE="$LOG_DIR/caddy.pid"
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

printf "Starting Caddy with config %s\n" "$CONFIG"
ADMIN_HOSTNAME="${ADMIN_HOSTNAME:-admin.127.0.0.1.nip.io}" exec caddy run --config "$CONFIG" "$@"
