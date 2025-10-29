#!/bin/bash
# Cloudflare Pages Environment Setup Script
# This script helps configure environment variables for Cloudflare Pages deployment
# Usage: ./setup-cloudflare-env.sh [project-name] [environment]

set -e

PROJECT_NAME="${1:-easymo-admin}"
ENVIRONMENT="${2:-production}"

echo "🚀 Setting up Cloudflare Pages environment for: $PROJECT_NAME"
echo "📦 Environment: $ENVIRONMENT"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

echo "✅ Wrangler CLI found"
echo ""

# Login to Cloudflare
echo "🔐 Logging in to Cloudflare..."
wrangler login

echo ""
echo "📝 Setting up environment variables..."
echo ""

# Public variables (can be set as plain vars)
echo "Setting public variables..."

wrangler pages secret put NEXT_PUBLIC_SUPABASE_URL \
  --project-name="$PROJECT_NAME" \
  --env="$ENVIRONMENT" || true

wrangler pages secret put NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --project-name="$PROJECT_NAME" \
  --env="$ENVIRONMENT" || true

wrangler pages secret put NEXT_PUBLIC_DEFAULT_ACTOR_ID \
  --project-name="$PROJECT_NAME" \
  --env="$ENVIRONMENT" || true

echo ""
echo "Setting server-side secrets..."
echo "⚠️  WARNING: These are sensitive values. Do NOT expose to client!"
echo ""

# Server-side secrets (encrypted)
wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY \
  --project-name="$PROJECT_NAME" \
  --env="$ENVIRONMENT"

wrangler pages secret put ADMIN_SESSION_SECRET \
  --project-name="$PROJECT_NAME" \
  --env="$ENVIRONMENT"

wrangler pages secret put ADMIN_TOKEN \
  --project-name="$PROJECT_NAME" \
  --env="$ENVIRONMENT"

wrangler pages secret put EASYMO_ADMIN_TOKEN \
  --project-name="$PROJECT_NAME" \
  --env="$ENVIRONMENT"

wrangler pages secret put ADMIN_ACCESS_CREDENTIALS \
  --project-name="$PROJECT_NAME" \
  --env="$ENVIRONMENT"

echo ""
echo "✅ Environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Verify variables in Cloudflare Dashboard:"
echo "   https://dash.cloudflare.com/pages/view/$PROJECT_NAME/settings/environment-variables"
echo ""
echo "2. Deploy the application:"
echo "   cd admin-app && npm run deploy"
echo ""
echo "3. Configure custom domain:"
echo "   - Go to Cloudflare Pages → $PROJECT_NAME → Custom domains"
echo "   - Add: easymo.ikanisa.com"
echo ""
echo "4. Verify deployment:"
echo "   curl https://easymo.ikanisa.com"
echo ""
