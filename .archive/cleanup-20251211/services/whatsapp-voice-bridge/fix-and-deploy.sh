#!/bin/bash

# Fix OpenAI model and redeploy to Fly.io
# This script rebuilds and deploys with the correct model name

set -e

echo "🔧 Fixing OpenAI model configuration..."
echo ""

cd "$(dirname "$0")"

echo "✅ Model name fixed in:"
echo "   - fly.toml"
echo "   - src/voice-call-session.ts (default fallback)"
echo "   - All deploy scripts"
echo ""

echo "🚀 Rebuilding and deploying to Fly.io..."
echo ""

# Deploy with the updated configuration
flyctl deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📞 Test the voice call now!"
echo "   Watch logs: flyctl logs"
echo ""
