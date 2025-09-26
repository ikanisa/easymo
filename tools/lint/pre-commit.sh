#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if command -v npm >/dev/null 2>&1; then
  echo "→ Linting admin-app"
  npm install --prefix admin-app >/dev/null 2>&1 || true
  npm run --prefix admin-app lint -- --max-warnings=0
else
  echo "⚠️  npm not available; skipped admin-app lint" >&2
fi

if command -v deno >/dev/null 2>&1; then
  deno_major="$(deno --version | awk 'NR==1 { split($2, parts, "."); print parts[1] }')"
  if [[ "$deno_major" -ge 2 ]]; then
    echo "⚠️  Deno v${deno_major} detected; skipping Deno lint/tests (std@0.224.0 incompatibility)" >&2
  else
    echo "→ Deno fmt + lint"
    deno fmt --config deno.json --check supabase/functions tests/edge
    deno lint --config deno.json
    echo "→ Deno tests"
    deno test tests/edge
    deno test --allow-env supabase/functions/wa-webhook/notify/sender.test.ts
    echo "→ SQL migration hygiene"
    deno run --allow-read tools/sql/check_migrations.ts
    echo "→ Legacy archive reference scan"
    deno run --allow-read tools/lint/check_archive_refs.ts
  fi
else
  echo "⚠️  deno not available; skipped Deno lint/tests" >&2
fi
