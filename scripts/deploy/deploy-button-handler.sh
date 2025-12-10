#!/bin/bash
# =====================================================================
# FINAL DEPLOYMENT - WhatsApp Button Handler
# =====================================================================
# Deploy the updated wa-webhook-core with opt-out button handler
# =====================================================================

set -e

echo "🚀 Final Deployment - WhatsApp Button Handler"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Set credentials
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"

# Deploy wa-webhook-core
echo "📦 Deploying wa-webhook-core with button handler..."
supabase functions deploy wa-webhook-core --project-ref lhbowpbcpwoiparwnwgt

echo ""
echo "✅ Deployment complete!"
echo ""

# Verify deployment
echo "🔍 Verifying deployment..."
curl -s https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TESTING INSTRUCTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Send WhatsApp message: SUBSCRIBE"
echo "   Expected: Receive welcome message"
echo ""
echo "2. Wait for intent notification (if you have pending intents)"
echo "   Expected: Notification with '🔕 Stop notifications' button"
echo ""
echo "3. Click the button"
echo "   Expected: Receive 'Notifications Stopped' message"
echo ""
echo "4. Send WhatsApp message: SUBSCRIBE"
echo "   Expected: Receive 'Welcome Back!' message"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
