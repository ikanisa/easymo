#!/bin/bash

# Ensures Supabase migrations are sourced from the canonical directory.
# Previously restored SQL from supabase/migrations-broken/, but that archive
# has now been merged back into supabase/migrations/.

set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌ Expected migrations directory '$MIGRATIONS_DIR' to exist." >&2
  exit 1
fi

if [ -d "supabase/migrations-broken" ]; then
  echo "⚠️  Detected legacy 'supabase/migrations-broken/' directory." >&2
  echo "    Please remove or archive it to avoid diverging migrations." >&2
  exit 1
fi

echo "✅ Supabase migrations are managed from '$MIGRATIONS_DIR'."
echo "   Use 'supabase db reset' (or your CI pipeline) to apply them from scratch."

echo "Listing latest migrations for verification:"
ls -1 "$MIGRATIONS_DIR" | grep -E '\.sql$' | tail -n 20
