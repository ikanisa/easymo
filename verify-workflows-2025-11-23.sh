#!/bin/bash
# EasyMO Workflows Verification Script
# Generated: 2025-11-23
# Purpose: Verify implementation status of critical workflows

set -e

echo "========================================="
echo "EasyMO Workflows Verification"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_mark="${GREEN}✓${NC}"
cross_mark="${RED}✗${NC}"
warning_mark="${YELLOW}⚠${NC}"

# 1. Check Insurance Tables
echo -e "\n${YELLOW}1. INSURANCE WORKFLOW${NC}"
echo "================================="

tables=(
  "insurance_leads"
  "insurance_media"
  "insurance_quotes"
  "insurance_admins"
  "insurance_admin_contacts"
  "insurance_admin_notifications"
  "insurance_media_queue"
)

for table in "${tables[@]}"; do
  if psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null | grep -q 't'; then
    echo -e "${check_mark} Table exists: $table"
  else
    echo -e "${cross_mark} Missing table: $table"
  fi
done

# Check insurance OCR function
if [ -d "supabase/functions/insurance-ocr" ]; then
  echo -e "${check_mark} Edge function exists: insurance-ocr"
else
  echo -e "${cross_mark} Missing function: insurance-ocr"
fi

# Check insurance agent
if [ -f "supabase/functions/wa-webhook/domains/ai-agents/insurance_agent.ts" ]; then
  echo -e "${check_mark} AI agent exists: insurance_agent.ts"
else
  echo -e "${cross_mark} Missing AI agent: insurance_agent.ts"
fi

# 2. Check Referral System
echo -e "\n${YELLOW}2. REFERRAL SYSTEM${NC}"
echo "================================="

referral_tables=(
  "referral_links"
  "referral_clicks"
  "referral_attributions"
)

for table in "${referral_tables[@]}"; do
  if psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null | grep -q 't'; then
    echo -e "${check_mark} Table exists: $table"
  else
    echo -e "${cross_mark} Missing table: $table"
  fi
done

# Check RPC function
if psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'referral_apply_code_v2');" 2>/dev/null | grep -q 't'; then
  echo -e "${check_mark} RPC function exists: referral_apply_code_v2"
else
  echo -e "${cross_mark} Missing RPC: referral_apply_code_v2"
fi

# Check share utilities
if [ -f "supabase/functions/wa-webhook/utils/share.ts" ]; then
  echo -e "${check_mark} Share utilities exist: share.ts"
else
  echo -e "${cross_mark} Missing utilities: share.ts"
fi

# 3. Check MOMO QR System
echo -e "\n${YELLOW}3. MOMO QR CODE GENERATION${NC}"
echo "================================="

# Check countries table
if psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'countries');" 2>/dev/null | grep -q 't'; then
  echo -e "${check_mark} Table exists: countries"
  
  # Check MOMO supported countries
  count=$(psql $DATABASE_URL -tAc "SELECT COUNT(*) FROM countries WHERE momo_supported = true;" 2>/dev/null || echo "0")
  echo -e "  ${GREEN}→${NC} MOMO supported countries: $count"
else
  echo -e "${cross_mark} Missing table: countries"
fi

# Check MOMO utilities
if [ -f "supabase/functions/wa-webhook/utils/momo.ts" ]; then
  echo -e "${check_mark} MOMO utilities exist: momo.ts"
else
  echo -e "${cross_mark} Missing utilities: momo.ts"
fi

# Check admin MOMO QR flow
if [ -f "supabase/functions/wa-webhook/exchange/admin/momoqr.ts" ]; then
  echo -e "${check_mark} Admin QR flow exists: momoqr.ts"
else
  echo -e "${cross_mark} Missing admin flow: momoqr.ts"
fi

# 4. Check Wallet System
echo -e "\n${YELLOW}4. WALLET & TOKENS SYSTEM${NC}"
echo "================================="

wallet_functions=(
  "wallet_get_balance"
  "wallet_transfer_tokens"
  "wallet_redeem_tokens"
  "wallet_delta_fn"
)

for func in "${wallet_functions[@]}"; do
  if psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = '$func');" 2>/dev/null | grep -q 't'; then
    echo -e "${check_mark} RPC function exists: $func"
  else
    echo -e "${cross_mark} Missing RPC: $func"
  fi
done

# Check wallet domain files
wallet_files=(
  "home.ts"
  "earn.ts"
  "transfer.ts"
  "redeem.ts"
  "transactions.ts"
  "referral.ts"
)

for file in "${wallet_files[@]}"; do
  if [ -f "supabase/functions/wa-webhook/domains/wallet/$file" ]; then
    echo -e "${check_mark} Wallet module exists: $file"
  else
    echo -e "${cross_mark} Missing module: $file"
  fi
done

# 5. Check Rides System
echo -e "\n${YELLOW}5. RIDES WITH LOCATION CACHING${NC}"
echo "================================="

# Check location columns in profiles
if psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_location');" 2>/dev/null | grep -q 't'; then
  echo -e "${check_mark} Column exists: profiles.last_location"
else
  echo -e "${cross_mark} Missing column: profiles.last_location"
fi

if psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_location_at');" 2>/dev/null | grep -q 't'; then
  echo -e "${check_mark} Column exists: profiles.last_location_at"
else
  echo -e "${cross_mark} Missing column: profiles.last_location_at"
fi

# Check ride tables
ride_tables=(
  "ride_requests"
  "ride_notifications"
)

for table in "${ride_tables[@]}"; do
  if psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null | grep -q 't'; then
    echo -e "${check_mark} Table exists: $table"
  else
    echo -e "${cross_mark} Missing table: $table"
  fi
done

# Check nearby matching
if [ -f "supabase/functions/wa-webhook/domains/mobility/nearby.ts" ]; then
  echo -e "${check_mark} Nearby matching exists: nearby.ts"
  
  # Check if spatial index exists
  if psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'profiles_last_location_idx');" 2>/dev/null | grep -q 't'; then
    echo -e "${check_mark} Spatial index exists: profiles_last_location_idx"
  else
    echo -e "${warning_mark} Missing spatial index: profiles_last_location_idx"
  fi
else
  echo -e "${cross_mark} Missing module: nearby.ts"
fi

# 6. Check Environment Variables (without exposing values)
echo -e "\n${YELLOW}6. ENVIRONMENT VARIABLES${NC}"
echo "================================="

check_env_var() {
  local var_name=$1
  if [ -n "${!var_name}" ]; then
    echo -e "${check_mark} Set: $var_name"
  else
    echo -e "${warning_mark} Not set: $var_name (may use default or be optional)"
  fi
}

check_env_var "OPENAI_API_KEY"
check_env_var "GEMINI_API_KEY"
check_env_var "INSURANCE_MEDIA_BUCKET"
check_env_var "DATABASE_URL"
check_env_var "SUPABASE_URL"
check_env_var "SUPABASE_SERVICE_ROLE_KEY"

# 7. Summary
echo -e "\n${YELLOW}SUMMARY${NC}"
echo "================================="
echo "This verification checks for:"
echo "  1. Database tables and columns"
echo "  2. Edge functions and modules"
echo "  3. RPC functions"
echo "  4. Configuration files"
echo ""
echo "For complete verification, also run:"
echo "  - supabase db push (apply migrations)"
echo "  - supabase functions list (check deployed functions)"
echo "  - End-to-end testing with WhatsApp"
echo ""
echo -e "${GREEN}Verification complete!${NC}"
echo ""
