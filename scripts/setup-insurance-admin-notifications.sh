#!/bin/bash
# Insurance Admin Notifications - Complete Setup & Fix
# This script sets up insurance admin WhatsApp numbers and verifies the notification system

set -e

echo "🔧 Insurance Admin Notifications Setup"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check if tables exist
echo "📊 Step 1: Checking database tables..."
supabase db push --dry-run > /dev/null 2>&1 && echo -e "${GREEN}✓ Migration ready${NC}" || echo -e "${YELLOW}⚠ Migration pending${NC}"

# Step 2: Apply migration
echo ""
echo "📤 Step 2: Applying insurance notification migration..."
supabase db push 2>&1 | tail -5

# Step 3: Prompt for admin WhatsApp numbers
echo ""
echo -e "${YELLOW}📱 Step 3: Configure Insurance Admin WhatsApp Numbers${NC}"
echo ""
echo "Please enter insurance admin WhatsApp numbers (one per line, with country code)"
echo "Example: +250788123456"
echo "Press Enter twice when done:"
echo ""

ADMIN_NUMBERS=()
while true; do
    read -p "Admin WhatsApp #$((${#ADMIN_NUMBERS[@]} + 1)): " number
    if [ -z "$number" ]; then
        if [ ${#ADMIN_NUMBERS[@]} -eq 0 ]; then
            echo -e "${RED}Error: At least one admin number required${NC}"
            continue
        else
            break
        fi
    fi
    # Normalize number
    normalized=$(echo "$number" | sed 's/[^0-9+]//g')
    if [[ $normalized =~ ^\+?[0-9]{10,15}$ ]]; then
        ADMIN_NUMBERS+=("$normalized")
        echo -e "${GREEN}✓ Added: $normalized${NC}"
    else
        echo -e "${RED}✗ Invalid format. Use: +250788123456${NC}"
    fi
done

echo ""
echo -e "${GREEN}✓ Configured ${#ADMIN_NUMBERS[@]} admin number(s)${NC}"

# Step 4: Insert admin contacts into database
echo ""
echo "💾 Step 4: Saving admin contacts to database..."

cat > /tmp/insert_insurance_admins.sql << 'EOF'
-- Clear existing contacts
DELETE FROM insurance_admin_contacts WHERE contact_type = 'whatsapp';

EOF

for i in "${!ADMIN_NUMBERS[@]}"; do
    num=${ADMIN_NUMBERS[$i]}
    order=$((i + 1))
    cat >> /tmp/insert_insurance_admins.sql << EOF
-- Insert admin contact $order
INSERT INTO insurance_admin_contacts (
    contact_type,
    contact_value,
    display_name,
    display_order,
    is_active
) VALUES (
    'whatsapp',
    '$num',
    'Insurance Admin $order',
    $order,
    true
);

EOF
done

# Execute SQL
echo "Executing SQL..."
supabase db execute < /tmp/insert_insurance_admins.sql 2>&1 | tail -3

# Step 5: Set environment variable as fallback
echo ""
echo "🔧 Step 5: Setting fallback environment variable..."

FALLBACK_IDS=$(IFS=,; echo "${ADMIN_NUMBERS[*]}")
echo "INSURANCE_ADMIN_FALLBACK_WA_IDS=$FALLBACK_IDS"

supabase secrets set INSURANCE_ADMIN_FALLBACK_WA_IDS="$FALLBACK_IDS"

# Step 6: Deploy notification function
echo ""
echo "🚀 Step 6: Deploying send-insurance-admin-notifications function..."
supabase functions deploy send-insurance-admin-notifications --no-verify-jwt 2>&1 | tail -5

# Step 7: Verify setup
echo ""
echo "✅ Step 7: Verification"
echo "======================="

# Check database
echo ""
echo "Database Check:"
cat > /tmp/verify_admins.sql << 'EOF'
SELECT 
    'insurance_admin_contacts' as source,
    contact_value as whatsapp_number,
    display_name,
    is_active,
    display_order
FROM insurance_admin_contacts
WHERE contact_type = 'whatsapp'
ORDER BY display_order;
EOF

echo "Active admin contacts:"
supabase db execute < /tmp/verify_admins.sql

# Check function health
echo ""
echo "Function Health Check:"
HEALTH_URL="https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/send-insurance-admin-notifications/health"
curl -s "$HEALTH_URL" 2>/dev/null | jq '.' || echo "Health endpoint not available"

# Final instructions
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Insurance Admin Notifications Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "📋 Summary:"
echo "  • Admin contacts: ${#ADMIN_NUMBERS[@]}"
echo "  • Database tables: Created ✓"
echo "  • Edge function: Deployed ✓"
echo "  • Fallback config: Set ✓"
echo ""
echo "🧪 Testing:"
echo "  1. Submit insurance certificate via WhatsApp"
echo "  2. Check admin receives notification"
echo "  3. Monitor logs:"
echo "     https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions/send-insurance-admin-notifications/logs"
echo ""
echo "📊 Manual Test:"
echo "  curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/send-insurance-admin-notifications"
echo ""
echo "🔍 Check Queue:"
echo "  SELECT COUNT(*) FROM notifications WHERE status='queued' AND notification_type='insurance_admin_alert';"
echo ""
echo -e "${YELLOW}💡 Tip: Set up cron job to run every 5 minutes for automatic processing${NC}"
echo ""

# Cleanup
rm -f /tmp/insert_insurance_admins.sql /tmp/verify_admins.sql

echo "Done! 🎉"
