#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOG_DIR="$REPO_ROOT/.logs"
PID_FILE="$LOG_DIR/next.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No Next.js PID file found at $PID_FILE (already stopped?)."
  exit 0
fi

PID="$(<"$PID_FILE")"
if [[ -n "$PID" ]] && kill -0 "$PID" >/dev/null 2>&1; then
  kill "$PID" || true
  sleep 1
fi

rm -f "$PID_FILE"
echo "Stopped Next.js (if running)."

