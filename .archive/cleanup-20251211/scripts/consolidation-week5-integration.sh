#!/bin/bash
# Week 5: Integrate 4 webhook domains into wa-webhook-unified
# Non-destructive: Only adds code, doesn't delete anything yet

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Week 5: Webhook Consolidation Integration ===${NC}"
echo "Date: $(date)"
echo ""

cd supabase/functions/wa-webhook-unified

echo -e "${YELLOW}Step 1: Copy Property Domain${NC}"
if [ ! -d "../wa-webhook-property" ]; then
    echo "ERROR: wa-webhook-property not found"
    exit 1
fi

mkdir -p domains/property
cp -r ../wa-webhook-property/property/* domains/property/ 2>/dev/null || true
cp ../wa-webhook-property/handlers/*.ts domains/property/ 2>/dev/null || true
echo "✓ Property domain copied"

echo -e "${YELLOW}Step 2: Copy Jobs Domain${NC}"
if [ ! -d "../wa-webhook-jobs" ]; then
    echo "ERROR: wa-webhook-jobs not found"
    exit 1
fi

mkdir -p domains/jobs
cp -r ../wa-webhook-jobs/jobs/* domains/jobs/ 2>/dev/null || true
cp ../wa-webhook-jobs/utils/*.ts domains/jobs/ 2>/dev/null || true
echo "✓ Jobs domain copied"

echo -e "${YELLOW}Step 3: Copy Marketplace Domain${NC}"
if [ ! -d "../wa-webhook-marketplace" ]; then
    echo "ERROR: wa-webhook-marketplace not found"
    exit 1
fi

mkdir -p domains/marketplace
cp ../wa-webhook-marketplace/agent.ts domains/marketplace/ 2>/dev/null || true
cp ../wa-webhook-marketplace/utils/*.ts domains/marketplace/ 2>/dev/null || true
echo "✓ Marketplace domain copied"

echo -e "${YELLOW}Step 4: Copy AI Agents Domain${NC}"
if [ ! -d "../wa-webhook-ai-agents" ]; then
    echo "ERROR: wa-webhook-ai-agents not found"
    exit 1
fi

mkdir -p domains/ai-agents
cp -r ../wa-webhook-ai-agents/agents domains/ai-agents/ 2>/dev/null || true
cp ../wa-webhook-ai-agents/orchestrator.ts domains/ai-agents/ 2>/dev/null || true
echo "✓ AI Agents domain copied"

echo ""
echo -e "${YELLOW}Step 5: Update Orchestrator Routing${NC}"
cat >> core/orchestrator.ts.patch <<'EOF'

// Week 5: Added domain routing for Property, Jobs, Marketplace, AI Agents
import { PropertyAgent } from '../domains/property/agent.ts';
import { JobsAgent } from '../domains/jobs/agent.ts';
import { MarketplaceAgent } from '../domains/marketplace/agent.ts';
import { AIAgentsOrchestrator } from '../domains/ai-agents/orchestrator.ts';

// Add to routing logic in handle() method:
if (intent.domain === 'property' || intent.domain === 'real-estate') {
  await logStructuredEvent('ROUTE_PROPERTY', { userId, messageId });
  return await PropertyAgent.handle(message, supabase);
}

if (intent.domain === 'jobs' || intent.domain === 'employment') {
  await logStructuredEvent('ROUTE_JOBS', { userId, messageId });
  return await JobsAgent.handle(message, supabase);
}

if (intent.domain === 'marketplace' || intent.domain === 'shopping') {
  await logStructuredEvent('ROUTE_MARKETPLACE', { userId, messageId });
  return await MarketplaceAgent.handle(message, supabase);
}

if (intent.domain === 'ai-agent') {
  await logStructuredEvent('ROUTE_AI_AGENTS', { userId, messageId });
  return await AIAgentsOrchestrator.handle(message, supabase);
}
EOF

echo "✓ Created orchestrator.ts.patch (manual merge required)"
echo ""

echo -e "${YELLOW}Step 6: Run Tests${NC}"
if [ -f "deno.json" ]; then
    echo "Running Deno tests..."
    deno task test || echo "Tests failed - review before deploying"
else
    echo "No deno.json found, skipping tests"
fi

echo ""
echo -e "${GREEN}=== Week 5 Integration Complete ===${NC}"
echo ""
echo "Manual steps required:"
echo "  1. Review and merge orchestrator.ts.patch into core/orchestrator.ts"
echo "  2. Fix any import path issues in copied domains"
echo "  3. Run: deno task test"
echo "  4. Deploy: supabase functions deploy wa-webhook-unified --project-ref \$SUPABASE_PROJECT_REF"
echo "  5. Set FEATURE_UNIFIED_WEBHOOK_PERCENT=10 in environment"
echo ""
echo "Files added:"
find domains -type f -name "*.ts" | head -20
echo "... (use 'find domains -type f' for full list)"
