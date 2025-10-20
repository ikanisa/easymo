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
  echo "→ Deno fmt + lint (staged)"
  # Collect staged files and filter to Deno-relevant paths
  DENO_FMT_FILES=()
  DENO_LINT_FILES=()
  while IFS= read -r f; do
    case "$f" in
      supabase/functions/*|tests/edge/*)
        case "$f" in
          *.ts|*.tsx|*.json|*.md|*.yaml|*.yml)
            DENO_FMT_FILES+=("$f")
            ;;
        esac
        case "$f" in
          *.ts|*.tsx)
            DENO_LINT_FILES+=("$f")
            ;;
        esac
        ;;
    esac
  done < <(git diff --cached --name-only --diff-filter=ACM || true)

  if ((${#DENO_FMT_FILES[@]})); then
    deno fmt --config deno.json --check "${DENO_FMT_FILES[@]}"
  else
    echo "(no staged Deno files for fmt)"
  fi

  if ((${#DENO_LINT_FILES[@]})); then
    deno lint --config deno.json "${DENO_LINT_FILES[@]}"
  else
    echo "(no staged Deno files for lint)"
  fi
  echo "→ Deno tests (only if Deno files staged)"
  if ((${#DENO_LINT_FILES[@]})) || ((${#DENO_FMT_FILES[@]})); then
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
  else
    echo "(no staged Deno files; skipping Deno unit tests)"
  fi
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
