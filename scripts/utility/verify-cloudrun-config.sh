#!/bin/bash
# Cloud Run Deployment Verification Script
# Checks that all required environment variables are configured

set -e

echo "🔍 Cloud Run Deployment Verification"
echo "===================================="
echo ""

# Check required env vars
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "EASYMO_ADMIN_TOKEN"
  "ADMIN_SESSION_SECRET"
)

echo "Checking required environment variables..."
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
    echo "❌ $var - MISSING"
  else
    # Mask sensitive values
    if [[ "$var" == *"KEY"* ]] || [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"TOKEN"* ]]; then
      echo "✅ $var - Set (${!var:0:10}...)"
    else
      echo "✅ $var - Set (${!var})"
    fi
  fi
done

echo ""

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "⚠️  Missing ${#MISSING_VARS[@]} required variable(s):"
  printf '   - %s\n' "${MISSING_VARS[@]}"
  echo ""
  echo "Set them using:"
  echo "  export NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co"
  echo "  export NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=xxx"
  echo "  export EASYMO_ADMIN_TOKEN=xxx"
  echo "  export ADMIN_SESSION_SECRET=xxx"
  exit 1
fi

# Validate session secret length
if [ ${#ADMIN_SESSION_SECRET} -lt 32 ]; then
  echo "❌ ADMIN_SESSION_SECRET must be at least 32 characters (current: ${#ADMIN_SESSION_SECRET})"
  exit 1
fi

# Check for common mistakes
if [[ "$NEXT_PUBLIC_SUPABASE_ANON_KEY" == *"service_role"* ]]; then
  echo "❌ ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY contains 'service_role'"
  echo "   Never use service role key in client-side variables!"
  exit 1
fi

echo "✅ All required environment variables are properly configured"
echo ""
echo "Optional microservice URLs:"
OPTIONAL_VARS=(
  "NEXT_PUBLIC_AGENT_CORE_URL"
  "NEXT_PUBLIC_VOICE_BRIDGE_API_URL"
  "NEXT_PUBLIC_MARKETPLACE_RANKING_URL"
  "NEXT_PUBLIC_MARKETPLACE_VENDOR_URL"
  "NEXT_PUBLIC_MARKETPLACE_BUYER_URL"
  "NEXT_PUBLIC_WALLET_SERVICE_URL"
)

for var in "${OPTIONAL_VARS[@]}"; do
  if [ -n "${!var}" ]; then
    echo "✅ $var - ${!var}"
  else
    echo "⚪ $var - Not set (optional)"
  fi
done

echo ""
echo "🎉 Environment configuration verified successfully!"
