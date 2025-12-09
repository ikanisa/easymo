#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DEFAULT_CONFIG="$REPO_ROOT/infra/cloudflared/config.yml"
CONFIG="$DEFAULT_CONFIG"
if [[ -n "${CLOUDFLARED_CONFIG:-}" ]]; then
  CONFIG="$CLOUDFLARED_CONFIG"
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

printf "Starting Cloudflared tunnel using %s\n" "$CONFIG"
exec cloudflared tunnel --config "$CONFIG" run "$@"
