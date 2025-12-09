#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOG_DIR="$REPO_ROOT/.logs"
PID_FILE="$LOG_DIR/caddy.pid"

err() {
  printf "\033[31mERROR:\033[0m %s\n" "$1" >&2
}

info() {
  printf "\033[32mINFO:\033[0m %s\n" "$1"
}

if [[ ! -f "$PID_FILE" ]]; then
  err "No PID file found at $PID_FILE. Is Caddy running in the background?"
  exit 1
fi

PID="$(<"$PID_FILE")"
if [[ -z "$PID" ]]; then
  err "PID file $PID_FILE is empty. Remove it manually and restart Caddy."
  exit 1
fi

if ! kill -0 "$PID" >/dev/null 2>&1; then
  err "Process $PID is not running. Removing stale PID file."
  rm -f "$PID_FILE"
  exit 1
fi

kill "$PID"
info "Sent SIGTERM to Caddy (PID $PID)."

for _ in {1..10}; do
  if ! kill -0 "$PID" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if kill -0 "$PID" >/dev/null 2>&1; then
  warn="Caddy did not exit after 10 seconds; sending SIGKILL."
  printf "\033[33mWARNING:\033[0m %s\n" "$warn" >&2
  kill -9 "$PID"
fi

rm -f "$PID_FILE"
info "Caddy stopped and PID file removed."
