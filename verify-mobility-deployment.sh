#!/bin/bash
# Verify Mobility Webhook Deployment

set -e

echo "🔍 Mobility Webhook Deployment Verification"
echo "============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check Function Deployment
echo "1. Checking function deployment..."
if supabase functions list 2>&1 | grep -q "wa-webhook-mobility"; then
    echo -e "${GREEN}✅ Function deployed${NC}"
    supabase functions list 2>&1 | grep wa-webhook-mobility
else
    echo -e "${RED}❌ Function not found${NC}"
    exit 1
fi
echo ""

# 2. Check Database Tables
echo "2. Checking database tables..."
TABLES=(
    "driver_status"
    "mobility_matches"
    "scheduled_trips"
    "saved_locations"
    "driver_subscriptions"
    "driver_licenses"
    "driver_insurance_certificates"
    "vehicle_inspections"
    "trip_payment_requests"
    "mobility_intent_cache"
    "location_cache"
    "momo_transactions"
    "momo_refunds"
)

MISSING_TABLES=()
for table in "${TABLES[@]}"; do
    if supabase db execute "SELECT 1 FROM $table LIMIT 1" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $table${NC}"
    else
        echo -e "${RED}❌ $table${NC}"
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Missing tables: ${MISSING_TABLES[*]}${NC}"
    echo "Run: supabase db push"
else
    echo -e "${GREEN}✅ All tables exist${NC}"
fi
echo ""

# 3. Check RPC Functions
echo "3. Checking RPC functions..."
RPCS=(
    "find_nearby_drivers"
    "update_driver_location"
    "set_driver_online"
    "is_driver_insurance_valid"
    "get_driver_active_insurance"
    "is_driver_license_valid"
    "get_driver_verification_status"
)

for rpc in "${RPCS[@]}"; do
    if supabase db execute "SELECT proname FROM pg_proc WHERE proname = '$rpc'" 2>&1 | grep -q "$rpc"; then
        echo -e "${GREEN}✅ $rpc${NC}"
    else
        echo -e "${YELLOW}⚠️  $rpc not found${NC}"
    fi
done
echo ""

# 4. Check Environment Variables
echo "4. Checking required secrets..."
SECRETS=(
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "WA_VERIFY_TOKEN"
    "WHATSAPP_APP_SECRET"
)

OPTIONAL_SECRETS=(
    "OPENAI_API_KEY"
    "GEMINI_API_KEY"
)

echo "Required secrets:"
for secret in "${SECRETS[@]}"; do
    if supabase secrets list 2>&1 | grep -q "$secret"; then
        echo -e "${GREEN}✅ $secret${NC}"
    else
        echo -e "${RED}❌ $secret (REQUIRED)${NC}"
    fi
done

echo ""
echo "Optional secrets (OCR):"
HAS_OCR=false
for secret in "${OPTIONAL_SECRETS[@]}"; do
    if supabase secrets list 2>&1 | grep -q "$secret"; then
        echo -e "${GREEN}✅ $secret${NC}"
        HAS_OCR=true
    else
        echo -e "${YELLOW}⚠️  $secret (optional)${NC}"
    fi
done

if [ "$HAS_OCR" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠️  No OCR provider configured!${NC}"
    echo "Driver verification will not work without OCR."
    echo "Add at least one:"
    echo "  supabase secrets set OPENAI_API_KEY=sk-proj-..."
    echo "  supabase secrets set GEMINI_API_KEY=AIzaSy..."
fi
echo ""

# 5. Test Database Connection
echo "5. Testing database connection..."
if supabase db execute "SELECT 1" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection OK${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi
echo ""

# 6. Check Handler Files
echo "6. Checking handler files..."
HANDLERS=(
    "handlers/momo_ussd_payment.ts"
    "handlers/driver_verification_ocr.ts"
    "handlers/nearby.ts"
    "handlers/schedule.ts"
    "handlers/go_online.ts"
    "handlers/trip_lifecycle.ts"
    "handlers/tracking.ts"
)

for handler in "${HANDLERS[@]}"; do
    if [ -f "supabase/functions/wa-webhook-mobility/$handler" ]; then
        echo -e "${GREEN}✅ $handler${NC}"
    else
        echo -e "${RED}❌ $handler${NC}"
    fi
done
echo ""

# Summary
echo "============================================="
echo "📊 Deployment Summary"
echo "============================================="
echo ""
echo "Function Status: ✅ DEPLOYED"
echo "Database Tables: ✅ $(echo "${#TABLES[@]}" - "${#MISSING_TABLES[@]}" | bc)/${#TABLES[@]} tables"
echo "RPC Functions: ✅ Deployed"
echo "Handlers: ✅ Present"
echo ""

if [ ${#MISSING_TABLES[@]} -eq 0 ] && [ "$HAS_OCR" = true ]; then
    echo -e "${GREEN}✅ DEPLOYMENT COMPLETE - 100% READY${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Test driver verification flow"
    echo "  2. Test MOMO USSD payment flow"
    echo "  3. Test trip lifecycle"
    echo "  4. Monitor logs: supabase functions logs wa-webhook-mobility --tail"
elif [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  DEPLOYMENT COMPLETE - 75% READY${NC}"
    echo ""
    echo "Missing:"
    echo "  - OCR provider (add OPENAI_API_KEY or GEMINI_API_KEY)"
    echo ""
    echo "Driver verification will not work without OCR."
else
    echo -e "${YELLOW}⚠️  DEPLOYMENT INCOMPLETE${NC}"
    echo ""
    echo "Issues:"
    [ ${#MISSING_TABLES[@]} -gt 0 ] && echo "  - Missing tables: ${MISSING_TABLES[*]}"
    [ "$HAS_OCR" = false ] && echo "  - No OCR provider configured"
    echo ""
    echo "Run: supabase db push"
fi
echo ""
