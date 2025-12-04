#!/bin/bash
# Test WhatsApp API Connectivity and Phone Number Validation

echo "🔍 Diagnosing WhatsApp Admin Notification Delivery Issue"
echo "========================================================"
echo ""

# Check database records
echo "📊 Database Status:"
echo "-------------------"
psql "$DATABASE_URL" -c "
SELECT 
  COUNT(*) as total,
  status,
  COUNT(*) FILTER (WHERE sent_at IS NOT NULL) as has_sent_at
FROM notifications 
WHERE notification_type = 'insurance_admin_alert' 
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
"

echo ""
echo "📱 Admin Contact Numbers:"
echo "-------------------------"
psql "$DATABASE_URL" -c "
SELECT contact_value, display_name, is_active 
FROM insurance_admin_contacts 
WHERE contact_type = 'whatsapp' 
ORDER BY display_order;
"

echo ""
echo "🚨 LIKELY ISSUE: WhatsApp Cloud API Restrictions"
echo "================================================"
echo ""
echo "WhatsApp Cloud API has the following restrictions:"
echo ""
echo "1. **Test Mode Limitation:**"
echo "   - In development/test mode, you can ONLY send to verified phone numbers"
echo "   - Numbers must be added in Meta Business Manager → WhatsApp → Phone Numbers"
echo ""
echo "2. **Template Message Requirement:**"
echo "   - Businesses cannot send freeform messages to users"
echo "   - You must use pre-approved Message Templates"
echo "   - OR the user must have messaged you first (24-hour window)"
echo ""
echo "3. **Phone Number Format:**"
echo "   - Must be E.164 format: country code + number (no + sign)"
echo "   - Example: 250795588248 NOT +250795588248"
echo ""
echo "✅ SOLUTION OPTIONS:"
echo "===================="
echo ""
echo "Option 1: Add Phone Numbers to WhatsApp Test Recipients"
echo "  → Go to: https://business.facebook.com/"
echo "  → Select your Business Portfolio"
echo "  → WhatsApp Accounts → Your Account → Phone Numbers"
echo "  → Query your admin numbers from database:"
echo "     SELECT contact_value FROM insurance_admin_contacts WHERE contact_type='whatsapp' AND is_active=true;"
echo "  → Add each number as a test recipient"
echo ""
echo "Option 2: Use Approved Message Template"
echo "  → Create and submit template: 'insurance_admin_alert'"
echo "  → Wait for Meta approval (usually 15 minutes)"
echo "  → Template body: 'New insurance certificate: {{1}}'"
echo ""
echo "Option 3: Have Admins Message the Bot First"
echo "  → Each admin sends any message to your WhatsApp number"
echo "  → This opens a 24-hour messaging window"
echo "  → Your bot can then send freeform messages"
echo ""
echo "📋 Next Steps:"
echo "==============" 
echo "1. Check Meta Business Manager for WhatsApp account status"
echo "2. Verify if account is in Production or Development mode"
echo "3. If Development: Add admin numbers as test recipients"
echo "4. If Production: Create approved message template"
echo ""
