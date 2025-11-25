#!/bin/bash

# Share EasyMO Fix - Deployment Script
# Restores referral link generation and QR code sharing

set -e

echo "🔗 Deploying Share EasyMO Fix..."
echo ""

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  exit 1
fi

echo "✅ Environment configured"
echo ""

# Deploy wa-webhook-profile function (has the fix)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying wa-webhook-profile function..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
supabase functions deploy wa-webhook-profile --project-ref lhbowpbcpwoiparwnwgt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🧪 Test the Share EasyMO feature:"
echo "1. Open WhatsApp and message +228 93 00 27 51"
echo "2. Navigate to Wallet & Profile"
echo "3. Select 'Earn tokens'"
echo "4. Tap 'Share via WhatsApp' or 'Generate QR Code'"
echo ""
echo "Expected: You should receive a WhatsApp deep link with format:"
echo "https://wa.me/22893002751?text=REF%3AYOURCODE"
echo ""
echo "For QR: A QR code image should be sent"
echo ""
