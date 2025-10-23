#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
CLOUDFLARED_CONFIG_DEFAULT="$ROOT_DIR/infrastructure/cloudflared/config.yml"
CLOUDFLARED_CONFIG="${CLOUDFLARED_CONFIG:-$CLOUDFLARED_CONFIG_DEFAULT}"
PID_FILE="$RUN_DIR/cloudflared.pid"
LOG_FILE="$RUN_DIR/cloudflared.log"

mkdir -p "$RUN_DIR"

require_cloudflared() {
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "cloudflared command not found. Install it via scripts/install_caddy_cloudflared.sh" >&2
    exit 1
  fi
}

require_config() {
  if [[ ! -f "$CLOUDFLARED_CONFIG" ]]; then
    echo "Cloudflared config not found at $CLOUDFLARED_CONFIG" >&2
    exit 1
  fi
}

is_running() {
  local pid
  if [[ -f "$PID_FILE" ]]; then
    pid="$(<"$PID_FILE")"
    if [[ -n "$pid" && -d "/proc/$pid" ]]; then
      return 0
    else
      rm -f "$PID_FILE"
    fi
  fi
  return 1
}

start_tunnel_background() {
  require_cloudflared
  require_config

  if ! require_credentials; then
    echo "Continuing without default credential file." >&2
  fi

  if is_running; then
    echo "Cloudflared tunnel already running (pid $(<"$PID_FILE"))." >&2
    exit 1
  fi

  : > "$LOG_FILE"
  (cd "$ROOT_DIR" && nohup cloudflared tunnel --config "$CLOUDFLARED_CONFIG" run >>"$LOG_FILE" 2>&1 & echo $! >"$PID_FILE")
  sleep 1
  if ! is_running; then
    echo "Failed to start cloudflared. Check $LOG_FILE for details." >&2
    exit 1
  fi
  echo "cloudflared started in background with pid $(<"$PID_FILE"). Logs: $LOG_FILE"
}

stop_tunnel() {
  if ! is_running; then
    echo "cloudflared tunnel is not running."
    return
  fi

  local pid="$(<"$PID_FILE")"
  if kill "$pid" >/dev/null 2>&1; then
    echo "Sent SIGTERM to cloudflared (pid $pid)."
    wait "$pid" 2>/dev/null || true
  else
    echo "Failed to send SIGTERM to pid $pid; removing stale pid file." >&2
  fi
  rm -f "$PID_FILE"
}

require_credentials() {
  local default_cred="$HOME/.cloudflared/cert.pem"
  if [[ ! -f "$default_cred" ]]; then
    echo "Warning: Cloudflared credentials not found at $default_cred." >&2
    echo "Run 'cloudflared tunnel login' before starting the tunnel." >&2
    return 1
  fi
  return 0
}
