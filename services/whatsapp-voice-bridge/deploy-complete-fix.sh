#!/bin/bash

#######################################################################
# WhatsApp Voice Bridge - Complete Deployment Script
# 
# This script deploys all fixes for the OpenAI model configuration
# - Rebuilds and deploys voice bridge to Fly.io
# - Deploys updated edge function to Supabase
# - Verifies deployments
# - Provides testing instructions
#######################################################################

set -e  # Exit on error

echo "============================================================================"
echo "WhatsApp Voice Bridge - Complete Deployment"
echo "============================================================================"
echo ""
echo "This will:"
echo "  1. Deploy voice bridge to Fly.io (whatsapp-voice-bridge-dark-dew-6515)"
echo "  2. Deploy edge function to Supabase (wa-webhook-voice-calls)"
echo "  3. Verify deployments"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

echo ""
echo "============================================================================"
echo "STEP 1: Deploying Voice Bridge to Fly.io"
echo "============================================================================"
echo ""

cd "$(dirname "$0")"

echo "📦 Building and deploying..."
flyctl deploy

if [ $? -ne 0 ]; then
    echo "❌ Fly.io deployment failed!"
    exit 1
fi

echo ""
echo "✅ Voice bridge deployed successfully!"
echo ""

# Wait for deployment to stabilize
echo "⏳ Waiting 10 seconds for deployment to stabilize..."
sleep 10

echo ""
echo "============================================================================"
echo "STEP 2: Checking Voice Bridge Health"
echo "============================================================================"
echo ""

HEALTH_URL="https://whatsapp-voice-bridge-dark-dew-6515.fly.dev/health"
echo "🔍 Checking health endpoint: $HEALTH_URL"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed!"
    echo "Response: $HEALTH_BODY"
else
    echo "❌ Health check failed! HTTP $HTTP_CODE"
    echo "Response: $HEALTH_BODY"
    exit 1
fi

echo ""
echo "============================================================================"
echo "STEP 3: Deploying Edge Function to Supabase"
echo "============================================================================"
echo ""

cd ../../../supabase

echo "📤 Deploying wa-webhook-voice-calls function..."
supabase functions deploy wa-webhook-voice-calls

if [ $? -ne 0 ]; then
    echo "❌ Supabase function deployment failed!"
    exit 1
fi

echo ""
echo "✅ Edge function deployed successfully!"
echo ""

echo "============================================================================"
echo "STEP 4: Verifying Deployments"
echo "============================================================================"
echo ""

echo "🔍 Checking Fly.io status..."
cd ../services/whatsapp-voice-bridge
flyctl status

echo ""
echo "🔍 Checking Supabase functions..."
cd ../../../supabase
supabase functions list | grep wa-webhook-voice-calls

echo ""
echo "============================================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "============================================================================"
echo ""
echo "📊 Deployment Summary:"
echo "  - Voice Bridge: https://whatsapp-voice-bridge-dark-dew-6515.fly.dev"
echo "  - Status: Running"
echo "  - Model: gpt-4o-realtime-preview (FIXED)"
echo "  - Edge Function: wa-webhook-voice-calls (latest version)"
echo ""
echo "============================================================================"
echo "📞 TESTING INSTRUCTIONS"
echo "============================================================================"
echo ""
echo "1. Watch logs in real-time:"
echo "   flyctl logs --app whatsapp-voice-bridge-dark-dew-6515"
echo ""
echo "2. Make a test call:"
echo "   - Call your WhatsApp business number"
echo "   - Speak when connected"
echo "   - AI should respond within 1-2 seconds"
echo ""
echo "3. Expected logs (SUCCESS):"
echo "   ✅ === STARTING VOICE CALL SESSION ==="
echo "   ✅ STEP 1: Setting up WebRTC peer connection..."
echo "   ✓ WebRTC setup complete"
echo "   ✅ STEP 2: Connecting to OpenAI Realtime API..."
echo "   ✓ OpenAI connection established  ← NO ERROR HERE"
echo "   ✅ STEP 3: Setting up audio bridging..."
echo "   ✓ Audio bridge configured"
echo "   ✅ === VOICE CALL SESSION READY ==="
echo ""
echo "4. What to listen for:"
echo "   - AI should greet you immediately"
echo "   - Clear audio (no distortion)"
echo "   - Quick responses (1-2 seconds)"
echo "   - Natural conversation flow"
echo ""
echo "============================================================================"
echo "🐛 TROUBLESHOOTING"
echo "============================================================================"
echo ""
echo "If you still see 'invalid_model' error:"
echo "  1. Check logs: flyctl logs --app whatsapp-voice-bridge-dark-dew-6515"
echo "  2. Verify model in logs should be: gpt-4o-realtime-preview"
echo "  3. If still using old model, run: flyctl deploy --force"
echo ""
echo "If OpenAI connection fails for other reasons:"
echo "  1. Verify API key: echo \$OPENAI_API_KEY | head -c 20"
echo "  2. Check OpenAI status: https://status.openai.com"
echo "  3. Review full logs for detailed error messages"
echo ""
echo "For audio issues:"
echo "  1. Check WebRTC logs for connection state"
echo "  2. Verify audio tracks are created"
echo "  3. Look for resampling errors"
echo ""
echo "============================================================================"
echo "📝 DOCUMENTATION"
echo "============================================================================"
echo ""
echo "Complete analysis: services/whatsapp-voice-bridge/COMPLETE_ANALYSIS_AND_FIX.md"
echo "Quick reference: services/whatsapp-voice-bridge/OPENAI_MODEL_FIX.md"
echo ""
echo "============================================================================"
echo "Done! 🎉"
echo "============================================================================"
