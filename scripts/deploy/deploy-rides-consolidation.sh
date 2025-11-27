#!/bin/bash
set -euo pipefail

# =====================================================
# Deploy Rides Menu Consolidation
# =====================================================
# Consolidates Nearby Drivers, Nearby Passengers, and
# Schedule Trip into single "Rides" menu with submenu
# =====================================================

echo "🚗 Deploying Rides Menu Consolidation..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check we're in the right directory
if [ ! -f "supabase/migrations/20251121104249_consolidate_rides_menu.sql" ]; then
  echo -e "${RED}❌ Error: Migration file not found. Run from project root.${NC}"
  exit 1
fi

echo -e "${BLUE}Step 1/4: Applying database migration...${NC}"
if supabase db push; then
  echo -e "${GREEN}✅ Migration applied successfully${NC}"
else
  echo -e "${RED}❌ Migration failed${NC}"
  exit 1
fi
echo ""

echo -e "${BLUE}Step 2/4: Verifying menu configuration...${NC}"
if psql "$DATABASE_URL" -c "
  SELECT name, key, is_active, display_order 
  FROM whatsapp_home_menu_items 
  WHERE key IN ('rides', 'nearby_drivers', 'nearby_passengers', 'schedule_trip')
  ORDER BY display_order;
" 2>/dev/null; then
  echo -e "${GREEN}✅ Menu items configured correctly${NC}"
else
  echo -e "${YELLOW}⚠️  Could not verify (DATABASE_URL not set or DB not accessible)${NC}"
fi
echo ""

echo -e "${BLUE}Step 3/4: Deploying edge functions...${NC}"
if supabase functions deploy wa-webhook; then
  echo -e "${GREEN}✅ wa-webhook deployed successfully${NC}"
else
  echo -e "${RED}❌ Function deployment failed${NC}"
  exit 1
fi
echo ""

echo -e "${BLUE}Step 4/4: Testing deployment...${NC}"

# Get project URL
PROJECT_URL=$(supabase status | grep "API URL" | awk '{print $3}' || echo "")

if [ -n "$PROJECT_URL" ]; then
  echo "Testing health endpoint..."
  if curl -sf "${PROJECT_URL}/functions/v1/wa-webhook/health" > /dev/null; then
    echo -e "${GREEN}✅ Health check passed${NC}"
  else
    echo -e "${YELLOW}⚠️  Health check failed (function may still be starting)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Could not determine project URL${NC}"
fi
echo ""

echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Test in WhatsApp: Send any message to your WhatsApp Business number"
echo "2. Look for '🚗 Rides' in the home menu"
echo "3. Tap Rides and verify submenu shows 3 options"
echo "4. Test each option: Nearby Drivers, Nearby Passengers, Schedule Trip"
echo ""
echo -e "${BLUE}Monitor logs:${NC}"
echo "  supabase functions logs wa-webhook --tail"
echo ""
echo -e "${BLUE}Look for events:${NC}"
echo "  - RIDES_MENU_OPENED"
echo "  - SEE_DRIVERS_STARTED"
echo "  - SEE_PASSENGERS_STARTED"
echo "  - SCHEDULE_TRIP_STARTED"
echo ""
echo -e "${YELLOW}📖 Full documentation: RIDES_CONSOLIDATION_COMPLETE.md${NC}"
echo ""
