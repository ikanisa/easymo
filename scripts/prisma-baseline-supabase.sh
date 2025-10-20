#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (e.g. export DATABASE_URL=postgresql://user:pass@host:5432/postgres)" >&2
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations_dir="${root_dir}/packages/db/prisma/migrations"

if [[ ! -d "${migrations_dir}" ]]; then
  echo "Unable to locate Prisma migrations directory at ${migrations_dir}" >&2
  exit 1
fi

echo "Baselining migrations in Supabase schema..."
for migration_path in "${migrations_dir}"/*; do
  migration_name="$(basename "${migration_path}")"
  echo "Marking ${migration_name} as applied"
  pnpm --filter @easymo/db prisma migrate resolve --applied "${migration_name}" >/dev/null
done

echo "Baseline complete. Existing Supabase schema is now marked as in-sync with Prisma."
