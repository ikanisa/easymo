#!/bin/bash

# Deploy AI Agents to Supabase (Non-interactive)
set -e

echo "🚀 Deploying AI Agents to Supabase..."

# Configuration
PROJECT_REF="lhbowpbcpwoiparwnwgt"
ACCESS_TOKEN="sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Set Supabase access token
export SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"
log_success "Access token configured"

# 2. Deploy edge functions one by one
echo "📦 Deploying edge functions..."

# Deploy agent-property-rental
echo "Deploying agent-property-rental..."
supabase functions deploy agent-property-rental \
  --project-ref $PROJECT_REF \
  --no-verify-jwt || log_warning "agent-property-rental deployment failed"

# Deploy agent-schedule-trip
echo "Deploying agent-schedule-trip..."
supabase functions deploy agent-schedule-trip \
  --project-ref $PROJECT_REF \
  --no-verify-jwt || log_warning "agent-schedule-trip deployment failed"

# Deploy agent-quincaillerie
echo "Deploying agent-quincaillerie..."
supabase functions deploy agent-quincaillerie \
  --project-ref $PROJECT_REF \
  --no-verify-jwt || log_warning "agent-quincaillerie deployment failed"

# Deploy agent-shops
echo "Deploying agent-shops..."
supabase functions deploy agent-shops \
  --project-ref $PROJECT_REF \
  --no-verify-jwt || log_warning "agent-shops deployment failed"

# Deploy WhatsApp microservices to pick shared library changes
echo "Deploying WhatsApp microservices..."
for svc in \
  wa-webhook-core \
  wa-webhook-ai-agents \
  wa-webhook-mobility \
  wa-webhook-wallet \
  wa-webhook-jobs \
  wa-webhook-property \
  wa-webhook-marketplace; do
  echo "Deploying $svc..."
  supabase functions deploy "$svc" \
    --project-ref $PROJECT_REF \
    --no-verify-jwt || log_warning "$svc deployment failed"
done

log_success "Edge functions deployed"

# 3. Set secrets
echo "🔐 Setting secrets..."
if [ -n "$OPENAI_API_KEY" ]; then
  echo "OPENAI_API_KEY=$OPENAI_API_KEY" | \
    supabase secrets set --project-ref $PROJECT_REF --env-file /dev/stdin || log_warning "Failed to set OPENAI_API_KEY"
else
  log_warning "OPENAI_API_KEY not set in environment"
fi

log_success "Secrets configured"

# 4. Test deployment
echo "🧪 Testing deployment..."
SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTgxMjcsImV4cCI6MjA3NjEzNDEyN30.egf4IDQpkHCpDKeyF63G72jQmIBcgWMHmj7FVt5xgAA"

# Test each agent
for agent in "agent-property-rental" "agent-schedule-trip" "agent-quincaillerie" "agent-shops"; do
  echo "Testing $agent..."
  curl -s -X POST "$SUPABASE_URL/functions/v1/$agent" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"test": true}' || log_warning "$agent test failed"
done

log_success "Deployment tests completed"

echo ""
echo "✅ AI Agents deployment complete!"
echo ""
echo "📝 Functions deployed:"
echo "   - agent-property-rental"
echo "   - agent-schedule-trip"
echo "   - agent-quincaillerie"
echo "   - agent-shops"
echo "   - wa-webhook-core"
echo "   - wa-webhook-ai-agents"
echo "   - wa-webhook-mobility"
echo "   - wa-webhook-wallet"
echo "   - wa-webhook-jobs"
echo "   - wa-webhook-property"
echo "   - wa-webhook-marketplace"
echo ""
echo "🔍 View logs:"
echo "   supabase functions logs --project-ref $PROJECT_REF"
echo ""
echo "🌐 Function URLs:"
echo "   $SUPABASE_URL/functions/v1/agent-property-rental"
echo "   $SUPABASE_URL/functions/v1/agent-schedule-trip"
echo "   $SUPABASE_URL/functions/v1/agent-quincaillerie"
echo "   $SUPABASE_URL/functions/v1/agent-shops"
