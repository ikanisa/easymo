#!/bin/bash

set -e  # Exit on error

echo "=========================================="
echo "WhatsApp Webhook Deployment - Phase 2"
echo "Project: EasyMo Platform"
echo "Date: $(date)"
echo "=========================================="
echo ""

cd /Users/jeanbosco/workspace/easymo

# Verify we're in the right place
if [ ! -d "supabase/functions/wa-webhook-core" ]; then
  echo "❌ Error: Not in easymo directory"
  exit 1
fi

echo "✅ In correct directory: $(pwd)"
echo ""

# Verify Supabase CLI is authenticated
echo "🔍 Verifying Supabase authentication..."
if ! supabase projects list > /dev/null 2>&1; then
  echo "❌ Error: Not authenticated with Supabase"
  echo "Run: supabase login"
  exit 1
fi

echo "✅ Supabase CLI authenticated"
echo ""

# Check if linked to correct project
echo "🔍 Verifying project link..."
PROJECT_REF=$(cat .git/supabase-ref 2>/dev/null || echo "")
if [ "$PROJECT_REF" != "lhbowpbcpwoiparwnwgt" ]; then
  echo "⚠️  Linking to project lhbowpbcpwoiparwnwgt..."
  supabase link --project-ref lhbowpbcpwoiparwnwgt
fi
echo "✅ Linked to correct project"
echo ""

# Verify secrets are set
echo "🔍 Verifying environment secrets..."
REQUIRED_SECRETS=(
  "WHATSAPP_ACCESS_TOKEN"
  "WHATSAPP_APP_SECRET"
  "WHATSAPP_VERIFY_TOKEN"
  "WHATSAPP_PHONE_NUMBER_ID"
)

MISSING_SECRETS=()
for secret in "${REQUIRED_SECRETS[@]}"; do
  if ! supabase secrets list 2>/dev/null | grep -q "$secret"; then
    MISSING_SECRETS+=("$secret")
  fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
  echo "❌ Error: Missing required secrets:"
  for secret in "${MISSING_SECRETS[@]}"; do
    echo "   - $secret"
  done
  echo ""
  echo "Set secrets with: supabase secrets set <NAME>=<VALUE>"
  exit 1
fi

echo "✅ All required secrets configured"
echo ""

# Deploy services in order
echo "=========================================="
echo "PHASE 2: DEPLOYING MICROSERVICES"
echo "=========================================="
echo ""

echo "📦 [1/9] Deploying wa-webhook-core (central router)..."
if supabase functions deploy wa-webhook-core --no-verify-jwt; then
  echo "   ✅ wa-webhook-core deployed successfully"
else
  echo "   ❌ Failed to deploy wa-webhook-core"
  exit 1
fi
echo ""

echo "📦 [2/7] Deploying wa-webhook-mobility (rides & logistics)..."
if supabase functions deploy wa-webhook-mobility --no-verify-jwt; then
  echo "   ✅ wa-webhook-mobility deployed successfully"
else
  echo "   ❌ Failed to deploy wa-webhook-mobility"
  exit 1
fi
echo ""

echo "📦 [3/7] Deploying wa-webhook-wallet (financial services)..."
if supabase functions deploy wa-webhook-wallet --no-verify-jwt; then
  echo "   ✅ wa-webhook-wallet deployed successfully"
else
  echo "   ❌ Failed to deploy wa-webhook-wallet"
  exit 1
fi
echo ""

echo "📦 [4/7] Deploying wa-webhook-buy-sell (marketplace & support)..."
if supabase functions deploy wa-webhook-buy-sell --no-verify-jwt; then
  echo "   ✅ wa-webhook-buy-sell deployed successfully"
else
  echo "   ❌ Failed to deploy wa-webhook-buy-sell"
  exit 1
fi
echo ""

echo "📦 [5/7] Deploying wa-webhook-profile (user profiles)..."
if supabase functions deploy wa-webhook-profile --no-verify-jwt; then
  echo "   ✅ wa-webhook-profile deployed successfully"
else
  echo "   ❌ Failed to deploy wa-webhook-profile"
  exit 1
fi
echo ""

echo "📦 [6/7] Deploying wa-webhook-insurance (insurance quotes)..."
if supabase functions deploy wa-webhook-insurance --no-verify-jwt; then
  echo "   ✅ wa-webhook-insurance deployed successfully"
else
  echo "   ❌ Failed to deploy wa-webhook-insurance"
  exit 1
fi
echo ""

echo "📦 [7/7] Deploying wa-webhook-voice-calls (voice handler)..."
if supabase functions deploy wa-webhook-voice-calls --no-verify-jwt; then
  echo "   ✅ wa-webhook-voice-calls deployed successfully"
else
  echo "   ❌ Failed to deploy wa-webhook-voice-calls"
  exit 1
fi
echo ""

echo "=========================================="
echo "✅ PHASE 2 DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""

echo "📊 Deployment Summary:"
echo ""
supabase functions list | grep -E "NAME|wa-webhook"
echo ""

echo "🔍 Verification Steps:"
echo ""
echo "1. Test health endpoint:"
echo "   curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health"
echo ""
echo "2. Test webhook verification:"
echo "   curl 'https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123'"
echo ""
echo "3. Send test WhatsApp message:"
echo "   Send 'Hi' to your WhatsApp Business number"
echo ""
echo "4. Monitor logs:"
echo "   supabase functions logs wa-webhook-core --tail"
echo ""

echo "📝 Next Steps:"
echo "   - Update Meta Webhook URL to: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core"
echo "   - Test all user flows (jobs, marketplace, rides, etc.)"
echo "   - Monitor logs for 24 hours"
echo "   - See WA_WEBHOOK_PHASE2_DEPLOYMENT.md for details"
echo ""

echo "✨ All WhatsApp webhook services are now operational!"
echo ""
