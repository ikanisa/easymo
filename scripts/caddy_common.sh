#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
CADDYFILE_DEFAULT="$ROOT_DIR/infrastructure/caddy/Caddyfile"
CADDYFILE="${CADDYFILE:-$CADDYFILE_DEFAULT}"
PID_FILE="$RUN_DIR/caddy.pid"
LOG_FILE="$RUN_DIR/caddy.log"

mkdir -p "$RUN_DIR"

require_caddy() {
  if ! command -v caddy >/dev/null 2>&1; then
    echo "caddy command not found. Install it via 'brew install caddy' or your preferred package manager." >&2
    exit 1
  fi
}

require_config() {
  if [[ ! -f "$CADDYFILE" ]]; then
    echo "Caddyfile not found at $CADDYFILE" >&2
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

start_caddy_background() {
  require_caddy
  require_config

  if is_running; then
    echo "Caddy appears to already be running (pid $(<"$PID_FILE"))." >&2
    exit 1
  fi

  : > "$LOG_FILE"
  (cd "$ROOT_DIR" && nohup caddy run --config "$CADDYFILE" --adapter caddyfile >>"$LOG_FILE" 2>&1 & echo $! >"$PID_FILE")
  sleep 1
  if ! is_running; then
    echo "Failed to start Caddy. Check $LOG_FILE for details." >&2
    exit 1
  fi
  echo "Caddy started in background with pid $(<"$PID_FILE"). Logs: $LOG_FILE"
}

stop_caddy() {
  if ! is_running; then
    echo "Caddy is not running."
    return
  fi

  local pid="$(<"$PID_FILE")"
  if kill "$pid" >/dev/null 2>&1; then
    echo "Sent SIGTERM to Caddy (pid $pid)."
    wait "$pid" 2>/dev/null || true
  else
    echo "Failed to send SIGTERM to pid $pid; removing stale pid file." >&2
  fi
  rm -f "$PID_FILE"
}
