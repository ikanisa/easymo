#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOG_DIR="$REPO_ROOT/.logs"
PID_FILE="$LOG_DIR/cloudflared.pid"
LOG_FILE="$LOG_DIR/cloudflared.log"
DEFAULT_CONFIG="$REPO_ROOT/infra/cloudflared/config.yml"
DEFAULT_CERT="$HOME/.cloudflared/cert.pem"

CONFIG="$DEFAULT_CONFIG"
if [[ -n "${CLOUDFLARED_CONFIG:-}" ]]; then
  CONFIG="$CLOUDFLARED_CONFIG"
elif [[ $# -gt 0 ]]; then
  CONFIG="$1"
  shift
fi

CERT_FILE="${CLOUDFLARED_CERT:-$DEFAULT_CERT}"

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

check_dependency "cloudflared" "Install it with 'brew install cloudflare/cloudflare/cloudflared'."

if [[ ! -f "$CONFIG" ]]; then
  example_path="$REPO_ROOT/infra/cloudflared/config.yml.example"
  if [[ -f "$example_path" ]]; then
    err "Cloudflared config not found at '$CONFIG'. Copy '$example_path' to '$CONFIG' and fill in your tunnel credentials, or set CLOUDFLARED_CONFIG to point at a custom file."
  else
    err "Cloudflared config not found at '$CONFIG'. Set CLOUDFLARED_CONFIG or pass the path as the first argument."
  fi
  exit 1
fi

if [[ ! -s "$CONFIG" ]]; then
  warn "Cloudflared config at '$CONFIG' is empty."
fi

if [[ ! -f "$CERT_FILE" ]]; then
  warn "Cloudflare cert not found at '$CERT_FILE'. Run 'cloudflared login' before starting the tunnel."
fi

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(<"$PID_FILE")"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
    err "Cloudflared already appears to be running with PID $existing_pid. Use scripts/mac/tunnel_down.sh to stop it first."
    exit 1
  else
    warn "Removing stale PID file at $PID_FILE."
    rm -f "$PID_FILE"
  fi
fi

info "Starting Cloudflared tunnel in the background using $CONFIG"
{
  printf "\n[%s] Starting Cloudflared with config %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$CONFIG"
} >>"$LOG_FILE"

cloudflared tunnel --config "$CONFIG" run "$@" >>"$LOG_FILE" 2>&1 &
PID=$!
sleep 1
if ! kill -0 "$PID" >/dev/null 2>&1; then
  err "Cloudflared failed to stay running. Check $LOG_FILE for details."
  exit 1
fi

echo "$PID" >"$PID_FILE"
info "Cloudflared is running in the background (PID $PID). Logs: $LOG_FILE"
