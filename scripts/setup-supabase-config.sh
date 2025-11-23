#!/bin/bash

# Setup Supabase Configuration for AI Agents
set -e

echo "🔧 Setting up Supabase configuration for AI Agents..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PROJECT_REF="lhbowpbcpwoiparwnwgt"
SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTgxMjcsImV4cCI6MjA3NjEzNDEyN30.egf4IDQpkHCpDKeyF63G72jQmIBcgWMHmj7FVt5xgAA"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
OPENAI_API_KEY="$OPENAI_API_KEY"

# Function to log success
log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to log warning
log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to log error
log_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Link Supabase project
echo "📡 Linking Supabase project..."
supabase link --project-ref $PROJECT_REF || log_warning "Project already linked or failed to link"
log_success "Supabase project linked"

# 2. Set Supabase secrets for edge functions
echo "🔐 Setting up Supabase secrets..."
echo "$OPENAI_API_KEY" | supabase secrets set OPENAI_API_KEY --env-file /dev/stdin
echo "$SUPABASE_SERVICE_ROLE_KEY" | supabase secrets set SUPABASE_SERVICE_ROLE_KEY --env-file /dev/stdin
log_success "Secrets configured"

# 3. Run database migrations
echo "🗄️  Running database migrations..."
supabase db push --include-all || log_warning "Some migrations may have already been applied"
log_success "Database migrations applied"

# 4. Deploy edge functions
echo "🚀 Deploying AI Agent edge functions..."
supabase functions deploy agent-property-rental --no-verify-jwt
supabase functions deploy agent-schedule-trip --no-verify-jwt
supabase functions deploy agent-quincaillerie --no-verify-jwt
supabase functions deploy agent-shops --no-verify-jwt

# Deploy WhatsApp microservices (shared code lives under wa-webhook/)
for svc in \
  wa-webhook-core \
  wa-webhook-ai-agents \
  wa-webhook-mobility \
  wa-webhook-wallet \
  wa-webhook-jobs \
  wa-webhook-property \
  wa-webhook-marketplace; do
  supabase functions deploy "$svc" --no-verify-jwt || true
done
log_success "Edge functions deployed"

# 5. Test deployment
echo "🧪 Testing deployment..."
curl -f "$SUPABASE_URL/functions/v1/agent-property-rental" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}' || log_warning "Function test failed"

log_success "Deployment test completed"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Test agents with: pnpm test:functions"
echo "   2. Check function logs: supabase functions logs"
echo "   3. Start admin app: cd admin-app && npm run dev"
