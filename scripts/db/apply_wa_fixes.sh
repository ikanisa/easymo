#!/usr/bin/env bash
set -euo pipefail

echo "==> Applying pending Supabase migrations (wa fixes)"
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install: https://supabase.com/docs/guides/cli" >&2
  exit 2
fi

# Apply all outstanding SQL migrations. This is idempotent.
supabase db push

echo "==> Optional verification (requires psql and SUPABASE_DB_URL)"
if command -v psql >/dev/null 2>&1 && [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  echo "Checking marketplace_categories.slug …"
  if psql "$SUPABASE_DB_URL" -Atc "select 1 from information_schema.columns where table_schema='public' and table_name='marketplace_categories' and column_name='slug';" | grep -q 1; then
    echo "OK: marketplace_categories.slug present"
  else
    echo "MISSING: marketplace_categories.slug" >&2
    exit 1
  fi
  echo "Checking public.whatsapp_menu_entries view …"
  if psql "$SUPABASE_DB_URL" -Atc "select 1 from pg_views where schemaname='public' and viewname='whatsapp_menu_entries';" | grep -q 1; then
    echo "OK: whatsapp_menu_entries view present"
  else
    echo "MISSING: whatsapp_menu_entries" >&2
    exit 1
  fi
  echo "Checking mobility matching numeric casts …"
  if psql "$SUPABASE_DB_URL" -Atc "select 1 from pg_proc where proname='match_drivers_for_trip_v2';" | grep -q 1; then
    echo "OK: match_drivers_for_trip_v2 exists (numeric casts defined in 20251025210000)"
  else
    echo "WARN: match_drivers_for_trip_v2 not found" >&2
  fi
else
  echo "Skipping verification: psql or SUPABASE_DB_URL not available."
fi

echo "==> Done"

