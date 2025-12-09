#!/usr/bin/env bash
set -euo pipefail

# Trap errors and clean up
trap 'echo "Error on line $LINENO. Exit code: $?" >&2' ERR

# Get script directories
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd "$APP_DIR/../.." && pwd)
cd "$REPO_ROOT"

# Configuration with validation
DB_URL="${RLS_TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:6543/ibimina_test}"

# Validate DB_URL format
if [[ ! "$DB_URL" =~ ^postgresql:// ]]; then
  echo "Error: Invalid database URL format. Must start with 'postgresql://'" >&2
  exit 1
fi

# Extract database name more robustly
DB_NAME=$(echo "$DB_URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')
if [[ -z "$DB_NAME" ]]; then
  echo "Error: Could not extract database name from URL" >&2
  exit 1
fi

ADMIN_URL="${DB_URL%/"$DB_NAME"}/postgres"

# Check if psql is available
if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is not installed or not in PATH" >&2
  exit 1
fi

# Drop and recreate database
echo "Resetting database: $DB_NAME"
if ! psql "$ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS "$DB_NAME" WITH (FORCE);
CREATE DATABASE "$DB_NAME";
SQL
then
  echo "Error: Failed to reset database" >&2
  exit 1
fi

# Apply bootstrap SQL
echo "Applying bootstrap fixtures..."
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/supabase/tests/fixtures/bootstrap.sql"; then
  echo "Error: Failed to apply bootstrap.sql" >&2
  exit 1
fi

# Apply migrations in order
echo "Applying migrations..."
migration_count=0

# Check if migrations directory exists
if [[ ! -d "$REPO_ROOT/supabase/migrations" ]]; then
  echo "Error: Migrations directory not found: $REPO_ROOT/supabase/migrations" >&2
  exit 1
fi

while IFS= read -r -d '' migration_file; do
  migration_name=$(basename "$migration_file")
  echo "  Applying: $migration_name"
  if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$migration_file" >/dev/null; then
    echo "Error: Failed applying $migration_name" >&2
    exit 1
  fi
  ((migration_count++))
done < <(find "$REPO_ROOT/supabase/migrations" -maxdepth 1 -name "*.sql" -type f -print0 | sort -z)

if [[ $migration_count -eq 0 ]]; then
  echo "Warning: No migrations found in $REPO_ROOT/supabase/migrations" >&2
fi

echo "Successfully applied $migration_count migrations"

# Apply test seed data
echo "Applying test seed data..."
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$REPO_ROOT/supabase/tests/rls/e2e_friendly_seed.sql" >/dev/null; then
  echo "Error: Failed to apply seed data" >&2
  exit 1
fi

echo "Database reset completed successfully"
