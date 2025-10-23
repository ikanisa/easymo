#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./tunnel_common.sh
source "$SCRIPT_DIR/tunnel_common.sh"

stop_tunnel
