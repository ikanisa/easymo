#!/usr/bin/env bash
set -euo pipefail

# Trap errors for better debugging
trap 'echo "Error on line $LINENO. Exit code: $?" >&2' ERR

# Get the application directory
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# Set environment defaults
export NODE_ENV="${NODE_ENV:-production}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
export NODE_PATH="${APP_DIR}/node_modules${NODE_PATH:+:${NODE_PATH}}"

# Validate build artifacts exist
if [ ! -d ".next" ]; then
  echo "Error: Missing .next build artifacts." >&2
  echo "Please run 'pnpm run build' before starting the server." >&2
  exit 1
fi

# Configuration with defaults
PORT_ENV="${PORT:-3100}"
HOST_ENV="${HOSTNAME:-0.0.0.0}"
EXTRA_ARGS=()
USE_STANDALONE="${ADMIN_USE_STANDALONE_START:-${USE_STANDALONE_START:-1}}"

# Parse command line arguments
while (($#)); do
  case "$1" in
    --port|-p)
      if [ -z "${2:-}" ]; then
        echo "Error: Missing value for --port" >&2
        exit 1
      fi
      # Validate port number
      if ! [[ "$2" =~ ^[0-9]+$ ]] || [ "$2" -lt 1 ] || [ "$2" -gt 65535 ]; then
        echo "Error: Port must be a number between 1 and 65535" >&2
        exit 1
      fi
      PORT_ENV="$2"
      shift 2
      ;;
    --hostname|--host|-H)
      if [ -z "${2:-}" ]; then
        echo "Error: Missing value for --hostname" >&2
        exit 1
      fi
      HOST_ENV="$2"
      shift 2
      ;;
    --help|-h)
      cat <<USAGE
Usage: $0 [OPTIONS]

Options:
  --port, -p PORT           Set the port (default: 3100)
  --hostname, --host HOST   Set the hostname (default: 0.0.0.0)
  --help, -h                Show this help message

Environment variables:
  PORT                          Port to listen on
  HOSTNAME                      Hostname to bind to
  USE_STANDALONE_START          Use standalone build (1) or next start (0)
  ADMIN_USE_STANDALONE_START    Alternative to USE_STANDALONE_START
  NODE_ENV                      Node environment (default: production)

The script will use the standalone build by default if available.
Set USE_STANDALONE_START=0 to force using 'next start'.
USAGE
      exit 0
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

# Export final configuration
export PORT="$PORT_ENV"
export HOSTNAME="$HOST_ENV"

echo "Starting Next.js application..."
echo "  Environment: $NODE_ENV"
echo "  Port: $PORT"
echo "  Hostname: $HOSTNAME"

# Try standalone build first if enabled
if [ "$USE_STANDALONE" = "1" ] && [ -d ".next/standalone" ]; then
  echo "  Using: Standalone build"
  
  # Create node_modules symlink if needed
  if [ ! -L ".next/standalone/node_modules" ]; then
    rm -rf ".next/standalone/node_modules" 2>/dev/null || true
    ln -s "$APP_DIR/node_modules" ".next/standalone/node_modules"
  fi
  
  # Ensure Next.js distribution files are present
  STANDALONE_DIST=".next/standalone/node_modules/next/dist"
  if [ ! -f "$STANDALONE_DIST/server/lib/cpu-profile.js" ] || [ ! -f "$STANDALONE_DIST/lib/get-network-host.js" ]; then
    SOURCE_DIST="$(node -p "require('path').join(require('path').dirname(require.resolve('next/package.json')), 'dist')" 2>/dev/null || echo "")"
    if [ -n "$SOURCE_DIST" ] && [ -d "$SOURCE_DIST" ]; then
      echo "  Copying Next.js distribution files..."
      mkdir -p "$STANDALONE_DIST"
      if command -v rsync >/dev/null 2>&1; then
        rsync -a "$SOURCE_DIST"/ "$STANDALONE_DIST"/ >/dev/null
      else
        # Fallback to cp if rsync is not available
        cp -r "$SOURCE_DIST"/* "$STANDALONE_DIST"/ 2>/dev/null || true
      fi
    fi
  fi
  
  # Copy vendor chunks if present
  if [ -d ".next/server/vendor-chunks" ]; then
    mkdir -p ".next/standalone/.next/server"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete ".next/server/vendor-chunks" ".next/standalone/.next/server/" >/dev/null
    else
      cp -r ".next/server/vendor-chunks" ".next/standalone/.next/server/" 2>/dev/null || true
    fi
  fi
  
  # Start standalone server
  if [ "${#EXTRA_ARGS[@]}" -gt 0 ]; then
    exec node .next/standalone/server.js "${EXTRA_ARGS[@]}"
  else
    exec node .next/standalone/server.js
  fi
fi

# Fallback to 'next start'
echo "  Using: next start"

# Check if pnpm is available
if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is not installed or not in PATH" >&2
  echo "Please install pnpm: npm install -g pnpm" >&2
  exit 1
fi

# Start with next start
if [ "${#EXTRA_ARGS[@]}" -gt 0 ]; then
  exec pnpm exec next start --hostname "$HOSTNAME" --port "$PORT" "${EXTRA_ARGS[@]}"
else
  exec pnpm exec next start --hostname "$HOSTNAME" --port "$PORT"
fi
