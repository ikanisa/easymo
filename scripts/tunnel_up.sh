#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./tunnel_common.sh
source "$SCRIPT_DIR/tunnel_common.sh"

require_cloudflared
require_config
if ! require_credentials; then
  echo "Continuing without default credential file." >&2
fi

cd "$ROOT_DIR"

exec cloudflared tunnel --config "$CLOUDFLARED_CONFIG" run
