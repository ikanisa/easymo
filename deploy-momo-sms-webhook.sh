#!/bin/bash
# Deploy MomoTerminal SMS Webhook for easymo-
# Resolves Issue #440

set -e

echo "🚀 Deploying MomoTerminal SMS Webhook..."

# Apply database migration
echo "📦 Applying database migration..."
supabase db push

# Deploy the edge function
echo "⚡ Deploying edge function..."
supabase functions deploy momo-sms-webhook --no-verify-jwt

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add webhook endpoint in Supabase Dashboard:"
echo "   https://<project-ref>.supabase.co/functions/v1/momo-sms-webhook"
echo ""
echo "2. Configure phone-to-service mappings in momo_webhook_endpoints table:"
echo "   INSERT INTO momo_webhook_endpoints (momo_phone_number, service_type, webhook_secret)"
echo "   VALUES ('+233XXXXXXXXX', 'rides', 'your-secret-here');"
echo ""
echo "3. Configure MomoTerminal app with the webhook URL and secret"
