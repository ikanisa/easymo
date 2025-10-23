#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./caddy_common.sh
source "$SCRIPT_DIR/caddy_common.sh"

stop_caddy
