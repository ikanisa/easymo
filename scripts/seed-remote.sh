#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEED_FILE="${PROJECT_ROOT}/supabase/seeders/phase2_seed.sql"

if [[ ! -f "${SEED_FILE}" ]]; then
  echo "Seed file not found at ${SEED_FILE}" >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'EOF'
SUPABASE_DB_URL is not set.
Export a Postgres connection string with service-role privileges, for example:

  export SUPABASE_DB_URL="postgresql://postgres:<password>@db.vacltfdslodqybxojytc.supabase.co:5432/postgres"

You can copy the password from Supabase Dashboard → Settings → Database.
EOF
  exit 1
fi

echo "Seeding remote database using ${SEED_FILE}"
psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -f "${SEED_FILE}"
