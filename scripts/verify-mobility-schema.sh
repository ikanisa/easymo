#!/bin/bash
# wa-webhook-mobility Schema Verification Script
# Purpose: Verify all database dependencies exist
# Related: WA_WEBHOOK_MOBILITY_DEEP_ANALYSIS.md

set -e

echo "🔍 wa-webhook-mobility Schema Verification"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL not set${NC}"
  echo "Please set DATABASE_URL to your Supabase database connection string"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Function to check table existence
check_table() {
  local table_name=$1
  local result=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table_name');")
  if [[ "$result" =~ "t" ]]; then
    echo -e "${GREEN}✅${NC} Table: $table_name"
    return 0
  else
    echo -e "${RED}❌${NC} Table: $table_name (MISSING)"
    return 1
  fi
}

# Function to check RPC function existence
check_rpc() {
  local func_name=$1
  local result=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = '$func_name');")
  if [[ "$result" =~ "t" ]]; then
    echo -e "${GREEN}✅${NC} RPC Function: $func_name"
    return 0
  else
    echo -e "${RED}❌${NC} RPC Function: $func_name (MISSING)"
    return 1
  fi
}

# Track failures
FAILURES=0

# Check Required Tables
echo "📊 Checking Required Tables..."
echo "--------------------------------"

check_table "rides_trips" || ((FAILURES++))
check_table "rides_driver_status" || ((FAILURES++))
check_table "scheduled_trips" || ((FAILURES++))
check_table "driver_insurance_certificates" || ((FAILURES++))
check_table "profiles" || ((FAILURES++))
check_table "drivers" || ((FAILURES++))
check_table "business" || ((FAILURES++))

echo ""

# Check Required RPC Functions
echo "⚙️  Checking Required RPC Functions..."
echo "----------------------------------------"

check_rpc "rides_update_driver_location" || ((FAILURES++))
check_rpc "is_driver_insurance_valid" || ((FAILURES++))
check_rpc "get_driver_active_insurance" || ((FAILURES++))
check_rpc "find_online_drivers_near_trip" || ((FAILURES++))
check_rpc "nearby_businesses_v2" || ((FAILURES++))
check_rpc "get_cached_location" || ((FAILURES++))
check_rpc "record_driver_notification" || ((FAILURES++))

echo ""

# Check PostGIS extension (required for location functions)
echo "🗺️  Checking PostGIS Extension..."
echo "----------------------------------"
postgis_result=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM pg_extension WHERE extname = 'postgis');")
if [[ "$postgis_result" =~ "t" ]]; then
  echo -e "${GREEN}✅${NC} PostGIS extension installed"
else
  echo -e "${RED}❌${NC} PostGIS extension (MISSING)"
  echo -e "${YELLOW}⚠️  Location-based features will not work${NC}"
  ((FAILURES++))
fi

echo ""

# Summary
echo "=========================================="
if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  echo "wa-webhook-mobility schema is complete."
  exit 0
else
  echo -e "${RED}❌ $FAILURES check(s) failed${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Apply migration: supabase db push"
  echo "2. Or run: psql \$DATABASE_URL -f supabase/migrations/20251125072800_create_mobility_rpc_functions.sql"
  echo ""
  echo "See: WA_WEBHOOK_MOBILITY_DEEP_ANALYSIS.md for details"
  exit 1
fi
