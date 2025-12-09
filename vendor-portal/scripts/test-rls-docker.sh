#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd "$APP_DIR/../.." && pwd)
COMPOSE_FILE="$REPO_ROOT/infra/docker/docker-compose.rls.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run RLS tests in a container." >&2
  exit 1
fi

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v
}
trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" up -d --wait

export RLS_TEST_DATABASE_URL="${RLS_TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:6543/ibimina_test}"

bash "$SCRIPT_DIR/test-rls.sh"
