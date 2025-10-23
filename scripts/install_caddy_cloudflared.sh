#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BREWFILE="${BREWFILE:-$ROOT_DIR/infrastructure/homebrew/Brewfile}"

cd "$ROOT_DIR"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required but was not found in PATH." >&2
  echo "Install Homebrew from https://brew.sh/ and re-run this script." >&2
  exit 1
fi

if [[ ! -f "$BREWFILE" ]]; then
  echo "Brewfile not found at $BREWFILE" >&2
  echo "Create a Brewfile that installs Caddy and Cloudflared or override BREWFILE." >&2
  exit 1
fi

echo "Using Brewfile at $BREWFILE"
BREW_BUNDLE_CMD=(brew bundle --file "$BREWFILE")

if [[ -n "${HOMEBREW_NO_AUTO_UPDATE:-}" ]]; then
  echo "HOMEBREW_NO_AUTO_UPDATE is set; brew bundle will respect it."
fi

"${BREW_BUNDLE_CMD[@]}"

cat <<'INSTRUCTIONS'

Post-install steps
------------------
1. Authenticate Cloudflare: run `cloudflared tunnel login` and follow the browser flow.
2. Create or fetch your tunnel credentials, then update `infrastructure/cloudflared/config.yml` with the tunnel name and routing rules.
3. Review `infrastructure/caddy/Caddyfile` and tailor the site definitions to match your environment.
4. Start the services: use `scripts/caddy_bg.sh` and `scripts/tunnel_bg.sh` (or the `_up` variants for foreground runs).
5. Confirm everything works by visiting the local site and checking the log files in `.run/` if issues arise.

INSTRUCTIONS
