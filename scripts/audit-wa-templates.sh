#!/bin/bash

# WhatsApp Template Audit Script
# Validates that all required templates exist and are approved

set -e

PROJECT_REF="${SUPABASE_PROJECT_REF:-lhbowpbcpwoiparwnwgt}"
WHATSAPP_BUSINESS_ID="${WHATSAPP_BUSINESS_ID}"
WHATSAPP_TOKEN="${WHATSAPP_TOKEN}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   WhatsApp Template Audit             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Required templates by agent
declare -A TEMPLATES
TEMPLATES[driver_negotiation]="driver_quote_request driver_quote_received driver_trip_confirmed"
TEMPLATES[pharmacy_orders]="pharmacy_order_request pharmacy_quote pharmacy_delivery_update"
TEMPLATES[shops_services]="shops_search_request shops_vendor_list shops_quote"
TEMPLATES[hardware]="hardware_request hardware_vendor_list hardware_quote"
TEMPLATES[property_rental]="property_search property_listing property_contact"
TEMPLATES[schedule_trip]="trip_scheduled trip_reminder trip_confirmed"
TEMPLATES[marketplace]="marketplace_browse marketplace_recommendation"
TEMPLATES[fuel_delivery]="fuel_request fuel_provider_list fuel_delivery_update"
TEMPLATES[food_delivery]="food_order food_restaurant_menu food_delivery_status"
TEMPLATES[grocery_delivery]="grocery_list grocery_store_options grocery_delivery"
TEMPLATES[laundry_services]="laundry_booking laundry_pickup_scheduled laundry_ready"
TEMPLATES[car_wash]="carwash_booking carwash_service_options carwash_confirmed"
TEMPLATES[beauty_salon]="beauty_booking beauty_service_menu beauty_confirmed"
TEMPLATES[home_cleaning]="cleaning_request cleaning_provider_list cleaning_scheduled"
TEMPLATES[tutoring]="tutor_request tutor_profile tutoring_session_booked"

FOUND=0
MISSING=0
PENDING=0

if [ -z "$WHATSAPP_TOKEN" ] || [ -z "$WHATSAPP_BUSINESS_ID" ]; then
  echo -e "${YELLOW}⚠️  WhatsApp credentials not configured${NC}"
  echo "Set WHATSAPP_TOKEN and WHATSAPP_BUSINESS_ID to audit templates"
  echo ""
  echo "Displaying expected templates instead:"
  echo ""
  
  for agent in "${!TEMPLATES[@]}"; do
    echo -e "${BLUE}Agent:${NC} ${agent}"
    echo -e "${YELLOW}Required Templates:${NC}"
    for template in ${TEMPLATES[$agent]}; do
      echo "  - $template"
    done
    echo ""
  done
  
  exit 0
fi

# Fetch templates from WhatsApp API
echo "Fetching templates from WhatsApp Business API..."
echo ""

RESPONSE=$(curl -s "https://graph.facebook.com/v18.0/${WHATSAPP_BUSINESS_ID}/message_templates" \
  -H "Authorization: Bearer ${WHATSAPP_TOKEN}")

if echo "$RESPONSE" | grep -q "error"; then
  echo -e "${RED}❌ Failed to fetch templates${NC}"
  echo "Error: $(echo $RESPONSE | jq -r '.error.message')"
  exit 1
fi

echo "$RESPONSE" > /tmp/wa_templates.json

# Check each agent's templates
for agent in "${!TEMPLATES[@]}"; do
  echo -e "${BLUE}=== ${agent} ===${NC}"
  
  for template in ${TEMPLATES[$agent]}; do
    STATUS=$(jq -r ".data[] | select(.name == \"$template\") | .status" /tmp/wa_templates.json)
    
    if [ -z "$STATUS" ] || [ "$STATUS" = "null" ]; then
      echo -e "${RED}❌ MISSING:${NC} $template"
      ((MISSING++))
    elif [ "$STATUS" = "APPROVED" ]; then
      echo -e "${GREEN}✅ APPROVED:${NC} $template"
      ((FOUND++))
    elif [ "$STATUS" = "PENDING" ]; then
      echo -e "${YELLOW}⏳ PENDING:${NC} $template"
      ((PENDING++))
    else
      echo -e "${YELLOW}⚠️  $STATUS:${NC} $template"
      ((PENDING++))
    fi
  done
  
  echo ""
done

# Summary
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Template Summary             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Approved: $FOUND${NC}"
echo -e "${YELLOW}⏳ Pending:  $PENDING${NC}"
echo -e "${RED}❌ Missing:  $MISSING${NC}"
echo ""

TOTAL=$((FOUND + PENDING + MISSING))
APPROVAL_RATE=$((FOUND * 100 / (TOTAL + 1)))

echo "Approval Rate: ${APPROVAL_RATE}%"
echo ""

if [ $MISSING -gt 0 ]; then
  echo -e "${RED}⚠️  Some templates are missing. Create them in WhatsApp Business Manager.${NC}"
  exit 1
elif [ $PENDING -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Some templates are pending approval.${NC}"
  exit 0
else
  echo -e "${GREEN}🎉 All templates approved!${NC}"
  exit 0
fi

# Cleanup
rm -f /tmp/wa_templates.json
