#!/bin/bash
# Deploy Phase 1: AI Lookup Tables
# 
# This script applies the lookup tables migration and verifies the deployment.

set -e  # Exit on error

echo "========================================"
echo "Phase 1: AI Lookup Tables Deployment"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
  echo "Please set DATABASE_URL environment variable:"
  echo "  export DATABASE_URL='postgresql://...'"
  exit 1
fi

echo -e "${YELLOW}Step 1: Applying migration...${NC}"
supabase db push

echo ""
echo -e "${YELLOW}Step 2: Verifying tables created...${NC}"

# Check each table
TABLES=("service_verticals" "job_categories" "property_types" "insurance_types" "moderation_rules" "tool_enum_values")

for table in "${TABLES[@]}"; do
  COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table WHERE is_active = true;" 2>/dev/null || echo "0")
  COUNT=$(echo $COUNT | xargs)  # Trim whitespace
  
  if [ "$COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} $table: $COUNT active records"
  else
    echo -e "${RED}✗${NC} $table: No records found"
  fi
done

echo ""
echo -e "${YELLOW}Step 3: Testing helper functions...${NC}"

# Test vertical detection
VERTICAL=$(psql "$DATABASE_URL" -t -c "SELECT detect_vertical_from_query('I need a taxi');" 2>/dev/null || echo "")
VERTICAL=$(echo $VERTICAL | xargs)

if [ "$VERTICAL" = "mobility" ]; then
  echo -e "${GREEN}✓${NC} detect_vertical_from_query() works"
else
  echo -e "${RED}✗${NC} detect_vertical_from_query() failed (got: '$VERTICAL', expected: 'mobility')"
fi

# Test out-of-scope check
OOS=$(psql "$DATABASE_URL" -t -c "SELECT is_query_out_of_scope('What is the weather today?');" 2>/dev/null || echo "")
OOS=$(echo $OOS | xargs)

if [ "$OOS" = "t" ]; then
  echo -e "${GREEN}✓${NC} is_query_out_of_scope() works"
else
  echo -e "${RED}✗${NC} is_query_out_of_scope() failed (got: '$OOS', expected: 't')"
fi

# Test enum values
ENUM_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM get_tool_enum_values('agent_id');" 2>/dev/null || echo "0")
ENUM_COUNT=$(echo $ENUM_COUNT | xargs)

if [ "$ENUM_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} get_tool_enum_values() works ($ENUM_COUNT values)"
else
  echo -e "${RED}✗${NC} get_tool_enum_values() failed"
fi

echo ""
echo -e "${YELLOW}Step 4: Data Summary...${NC}"

# Show vertical counts
echo ""
echo "Service Verticals:"
psql "$DATABASE_URL" -c "SELECT slug, name, array_length(keywords, 1) as keywords FROM service_verticals WHERE is_active = true ORDER BY priority DESC LIMIT 5;"

echo ""
echo "Job Categories:"
psql "$DATABASE_URL" -c "SELECT slug, name FROM job_categories WHERE is_active = true ORDER BY display_order LIMIT 5;"

echo ""
echo "Property Types:"
psql "$DATABASE_URL" -c "SELECT slug, name, is_residential, is_commercial FROM property_types WHERE is_active = true ORDER BY display_order LIMIT 5;"

echo ""
echo "Insurance Types:"
psql "$DATABASE_URL" -c "SELECT slug, name, requires_inspection FROM insurance_types WHERE is_active = true ORDER BY display_order;"

echo ""
echo "Moderation Rules:"
psql "$DATABASE_URL" -c "SELECT rule_type, category, severity, COUNT(*) as count FROM moderation_rules WHERE is_active = true GROUP BY rule_type, category, severity ORDER BY severity DESC;"

echo ""
echo "Tool Enum Values:"
psql "$DATABASE_URL" -c "SELECT enum_type, COUNT(*) as count FROM tool_enum_values WHERE is_active = true GROUP BY enum_type ORDER BY enum_type;"

echo ""
echo -e "${GREEN}========================================"
echo "✅ Phase 1 Deployment Complete!"
echo "========================================${NC}"
echo ""
echo "Next Steps:"
echo "1. Review PHASE_1_LOOKUP_TABLES_COMPLETE.md for usage examples"
echo "2. Update one service to use database lookups (Phase 2)"
echo "3. Test thoroughly before removing hardcoded files"
echo ""
echo "Quick Reference: AI_LOOKUP_TABLES_QUICK_REF.md"
echo ""
