#!/usr/bin/env bash
set -euo pipefail

# Fail if any Supabase function lockfile uses unsupported version (e.g. version "5").
# Conservative default: block version "5" which breaks the current bundler.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

bad=()
while IFS= read -r -d '' lock; do
  if grep -q '"version"\s*:\s*"5"' "$lock"; then
    bad+=("$lock")
  fi
done < <(find supabase/functions -type f -name 'deno.lock' -print0)

if (( ${#bad[@]} > 0 )); then
  echo "Unsupported Deno lockfile versions detected:" >&2
  for f in "${bad[@]}"; do
    echo " - $f" >&2
  done
  echo "\nFix: remove these lockfiles or regenerate with a compatible Deno version for the Supabase bundler." >&2
  exit 1
fi

echo "Deno lockfiles OK."

