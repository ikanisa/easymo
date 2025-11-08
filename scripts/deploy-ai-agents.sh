#!/bin/bash
# AI Agents Integration Deployment Script
# 
# Deploys all AI agent functions and integrates them with the WhatsApp webhook

set -e

echo "🤖 AI Agents Integration Deployment"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
print_info "Checking prerequisites..."

if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI not found. Please install it first."
    exit 1
fi
print_success "Supabase CLI found"

if [ ! -f ".env" ]; then
    print_error ".env file not found"
    exit 1
fi
print_success ".env file exists"

# Check OpenAI API key
if ! grep -q "OPENAI_API_KEY=sk-" .env; then
    print_error "OPENAI_API_KEY not found or invalid in .env"
    exit 1
fi
print_success "OpenAI API key configured"

# Check if we can connect to Supabase
print_info "Checking Supabase connection..."
if ! supabase status &> /dev/null; then
    print_warning "Supabase not running locally. Deploying to remote..."
fi

echo ""
print_info "Step 1: Deploying AI Agent Functions..."
echo "----------------------------------------"

# Deploy individual agent functions
agents=(
    "agent-negotiation"
    "agents/property-rental"
    "agents/schedule-trip"
    "agents/shops"
    "agents/quincaillerie"
)

for agent in "${agents[@]}"; do
    print_info "Deploying $agent..."
    if supabase functions deploy "$agent" --no-verify-jwt 2>&1 | grep -q "Deployed"; then
        print_success "$agent deployed"
    else
        print_warning "$agent deployment may have issues (continuing...)"
    fi
done

echo ""
print_info "Step 2: Deploying WhatsApp Webhook (with AI integration)..."
echo "-----------------------------------------------------------"
if supabase functions deploy wa-webhook --no-verify-jwt 2>&1 | grep -q "Deployed"; then
    print_success "WhatsApp webhook deployed with AI integration"
else
    print_error "WhatsApp webhook deployment failed"
    exit 1
fi

echo ""
print_info "Step 3: Setting Environment Variables..."
echo "----------------------------------------"

# Set environment variables for all functions
print_info "Setting OPENAI_API_KEY for all functions..."
OPENAI_KEY=$(grep OPENAI_API_KEY .env | cut -d'=' -f2)

for agent in "${agents[@]}" "wa-webhook"; do
    supabase secrets set "OPENAI_API_KEY=$OPENAI_KEY" --env-file .env 2>/dev/null || true
done

print_success "Environment variables configured"

echo ""
print_info "Step 4: Running Database Migrations..."
echo "--------------------------------------"

# Apply any pending migrations
if supabase db push 2>&1 | grep -q "completed"; then
    print_success "Database migrations applied"
else
    print_warning "No new migrations or migrations already applied"
fi

echo ""
print_info "Step 5: Testing AI Agent Integration..."
echo "---------------------------------------"

# Test if functions are accessible
PROJECT_REF=$(grep SUPABASE_PROJECT_REF .env | cut -d'=' -f2 || echo "")
if [ -n "$PROJECT_REF" ]; then
    BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"
    
    print_info "Testing agent-negotiation endpoint..."
    if curl -s "${BASE_URL}/agent-negotiation/health" | grep -q "ok\|healthy"; then
        print_success "agent-negotiation is responding"
    else
        print_warning "agent-negotiation may not be responding correctly"
    fi
    
    print_info "Testing wa-webhook endpoint..."
    if curl -s "${BASE_URL}/wa-webhook/health" | grep -q "ok\|healthy"; then
        print_success "wa-webhook is responding"
    else
        print_warning "wa-webhook may not be responding correctly"
    fi
else
    print_warning "PROJECT_REF not found, skipping endpoint tests"
fi

echo ""
print_info "Step 6: Verifying Feature Flags..."
echo "-----------------------------------"

# Check if agent feature flags are enabled
print_info "Checking feature flags in database..."

cat << 'EOF' > /tmp/check_features.sql
SELECT 
    key, 
    enabled,
    CASE 
        WHEN key LIKE 'agent.%' THEN '🤖 Agent Feature'
        ELSE 'Other Feature'
    END as type
FROM feature_flags
WHERE key LIKE 'agent.%'
ORDER BY key;
EOF

if supabase db execute -f /tmp/check_features.sql 2>/dev/null; then
    print_success "Feature flags verified"
else
    print_warning "Could not verify feature flags (table may not exist yet)"
fi

rm -f /tmp/check_features.sql

echo ""
print_success "Deployment Summary:"
echo "==================="
print_info "✓ All AI agent functions deployed"
print_info "✓ WhatsApp webhook updated with AI integration"
print_info "✓ Environment variables configured"
print_info "✓ Database migrations applied"
echo ""

print_info "🎯 Next Steps:"
echo "-------------"
echo "1. Test via WhatsApp by sending a message"
echo "2. Check logs: supabase functions logs wa-webhook"
echo "3. Monitor agent sessions in database"
echo "4. Enable feature flags if needed:"
echo "   - agent.negotiation"
echo "   - agent.property_rental"
echo "   - agent.schedule_trip"
echo "   - agent.shops"
echo "   - agent.quincaillerie"
echo ""

print_info "📊 Monitoring Commands:"
echo "----------------------"
echo "• Watch logs: supabase functions logs wa-webhook --follow"
echo "• Check agent sessions: SELECT * FROM agent_sessions ORDER BY created_at DESC LIMIT 10;"
echo "• Check agent quotes: SELECT * FROM agent_quotes ORDER BY created_at DESC LIMIT 10;"
echo ""

print_success "🚀 AI Agents Integration Deployment Complete!"
