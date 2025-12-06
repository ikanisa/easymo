#!/bin/bash

echo "🔍 Checking WhatsApp Webhook Configuration"
echo ""

# Check current webhook subscriptions
echo "1️⃣ Checking which function receives webhooks..."
echo ""
echo "Functions that might receive WhatsApp webhooks:"
supabase functions list | grep -E "wa-webhook"

echo ""
echo "2️⃣ To fix WhatsApp calling, you need to:"
echo ""
echo "   A) Go to: https://developers.facebook.com/apps"
echo "   B) Select your app → WhatsApp → Configuration"
echo "   C) In Webhooks section, make sure 'calls' is CHECKED"
echo "   D) Webhook URL should be one of these:"
echo "      - https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook"
echo "      - https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-voice-calls"
echo ""
echo "3️⃣ Enable calling on your phone number:"
echo "   A) Go to WhatsApp Business Manager"
echo "   B) Phone Numbers → Select your number"
echo "   C) Enable 'Calling Features'"
echo ""
