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
  echo "→ Deno fmt + lint"
  deno fmt --config deno.json --check supabase/functions tests/edge
  deno lint --config deno.json
  echo "→ Deno tests"
  SUPABASE_URL=http://localhost \
  SUPABASE_SERVICE_ROLE_KEY=test \
  WA_PHONE_ID=1 \
  WA_TOKEN=1 \
  WA_APP_SECRET=1 \
  WA_VERIFY_TOKEN=1 \
  VOUCHER_SIGNING_SECRET=test \
  deno test --allow-env --no-check supabase/functions/_shared/flow_crypto.test.ts
  SUPABASE_URL=http://localhost \
  SUPABASE_SERVICE_ROLE_KEY=test \
  WA_PHONE_ID=1 \
  WA_TOKEN=1 \
  WA_APP_SECRET=1 \
  WA_VERIFY_TOKEN=1 \
  VOUCHER_SIGNING_SECRET=test \
  deno test --allow-env --no-check supabase/functions/wa-webhook/notify/sender.test.ts
  echo "→ SQL migration hygiene"
  if ! deno run --allow-read tools/sql/check_migrations.ts; then
    echo "⚠️  Migration hygiene check failed (non-blocking)" >&2
  fi
  echo "→ Legacy archive reference scan"
  if ! deno run --allow-read tools/lint/check_archive_refs.ts; then
    echo "⚠️  Archive reference scan failed (non-blocking)" >&2
  fi
else
  echo "⚠️  deno not available; skipped Deno lint/tests" >&2
fi
