#!/bin/bash
# AI Agent Enhancement - Deployment Script
# Run this after reviewing the implementation

set -e

echo "🚀 AI Agent Enhancement Deployment"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
  echo -e "${RED}❌ OPENAI_API_KEY not set${NC}"
  echo "Please set it in Supabase secrets:"
  echo "  supabase secrets set OPENAI_API_KEY=your_key_here"
  exit 1
fi

echo -e "${GREEN}✓${NC} OPENAI_API_KEY configured"

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}❌ Supabase CLI not found${NC}"
  echo "Install: npm install -g supabase"
  exit 1
fi

echo -e "${GREEN}✓${NC} Supabase CLI installed"

# Deploy wa-webhook
echo ""
echo "📦 Deploying wa-webhook with AI enhancements..."
supabase functions deploy wa-webhook

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} wa-webhook deployed successfully"
else
  echo -e "${RED}❌ Deployment failed${NC}"
  exit 1
fi

# Create feature flag if not exists
echo ""
echo "🎛️  Setting up feature flag..."
supabase sql <<EOF
-- Create feature flags table if not exists
CREATE TABLE IF NOT EXISTS public.feature_flags (
  name TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert ai_agents_enabled flag (disabled by default for safety)
INSERT INTO public.feature_flags (name, enabled, description)
VALUES ('ai_agents_enabled', false, 'Enable AI agent system for WhatsApp')
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT name, enabled, description FROM public.feature_flags WHERE name = 'ai_agents_enabled';
EOF

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} Feature flag configured"
else
  echo -e "${YELLOW}⚠${NC}  Feature flag setup had issues (might already exist)"
fi

# Test deployment
echo ""
echo "🧪 Testing deployment..."
echo ""
echo "1. Check logs:"
echo "   supabase functions logs wa-webhook --follow"
echo ""
echo "2. Enable AI agents (when ready):"
echo "   supabase sql \"UPDATE feature_flags SET enabled = true WHERE name = 'ai_agents_enabled'\""
echo ""
echo "3. Send test message via WhatsApp:"
echo "   Example: 'Hi, I want to book a trip to Gisenyi'"
echo ""
echo "4. Monitor metrics:"
echo "   SELECT * FROM agent_conversations ORDER BY created_at DESC LIMIT 5;"
echo ""

# Deployment summary
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "📊 What was deployed:"
echo "   • AgentOrchestrator (5 specialized agents)"
echo "   • ToolRegistry (15 WhatsApp tools)"
echo "   • StreamingHandler (real-time responses)"
echo "   • Enhanced OpenAI integration"
echo ""
echo "🔒 Safety measures:"
echo "   • Feature flag disabled by default"
echo "   • Additive only - no breaking changes"
echo "   • Falls back to existing handlers on error"
echo ""
echo "📈 Next steps:"
echo "   1. Test with internal team"
echo "   2. Enable feature flag for beta users"
echo "   3. Monitor metrics and costs"
echo "   4. Gradual rollout to all users"
echo ""
echo "🚨 Rollback (if needed):"
echo "   supabase sql \"UPDATE feature_flags SET enabled = false WHERE name = 'ai_agents_enabled'\""
echo ""
echo "📚 Documentation:"
echo "   • Implementation: AI_AGENT_IMPLEMENTATION_COMPLETE_v2.md"
echo "   • Assessment: AI_AGENT_IMPLEMENTATION_ASSESSMENT.md"
echo ""
echo -e "${GREEN}Happy deploying! 🎉${NC}"
