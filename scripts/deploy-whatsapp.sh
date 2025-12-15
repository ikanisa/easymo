#!/usr/bin/env bash
set -euo pipefail

echo "==> easyMO WhatsApp Deployment"
echo ""

ROOT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/.." &> /dev/null && pwd )"
cd "$ROOT_DIR"

if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ Supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "-- Checking environment..."
node ./scripts/check-env.mjs || true

echo "-- Pushing database migrations..."
supabase db push

echo "-- Deploying Edge Functions (WA microservices + insurance-ocr)..."
supabase functions deploy \
  wa-webhook-core \
  wa-webhook-mobility \
  wa-webhook-wallet \
  wa-webhook-buy-sell \
  wa-webhook-profile \
  wa-webhook-insurance \
  wa-webhook-voice-calls

echo "-- Done."
echo ""
echo "Next steps:"
echo "  1) Verify secrets are set for your project (OPENAI_API_KEY or GEMINI_API_KEY, WA_*)."
echo "  2) Test WhatsApp flows: Insurance, MOMO QR, Wallet, Rides."
echo "  3) Tail logs if needed: supabase functions logs wa-webhook-core --tail (or any specific microservice)"
