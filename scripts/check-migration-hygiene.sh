#!/usr/bin/env bash
set -euo pipefail

# Fails if any new migration under supabase/migrations missing BEGIN/COMMIT wrappers.
# Existing exceptions can be listed in supabase/migrations/.hygiene_allowlist

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ALLOWLIST_FILE="supabase/migrations/.hygiene_allowlist"
is_allowlisted() {
  [[ -f "$ALLOWLIST_FILE" ]] || return 1
  grep -Fxq "$1" "$ALLOWLIST_FILE"
}

fail=0
while IFS= read -r -d '' file; do
  base="$(basename "$file")"
  [[ "$base" == ".keep" ]] && continue
  if is_allowlisted "$base"; then
    continue
  fi
  if ! grep -qiE '^\s*BEGIN;' "$file" || ! grep -qiE '^\s*COMMIT;' "$file"; then
    echo "Migration hygiene error: $base must start with BEGIN; and end with COMMIT;" >&2
    fail=1
  fi
done < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print0)

if (( fail != 0 )); then
  echo "\nHint: wrap the migration in a transaction or add the filename to $ALLOWLIST_FILE with justification." >&2
  exit 1
fi

echo "Migration hygiene OK."
