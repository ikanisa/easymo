#!/bin/bash
# Week 6: Traffic Migration 10% → 50% → 100%
# Monitors metrics at each stage

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Week 6: Traffic Migration to wa-webhook-unified ===${NC}"
echo "Date: $(date)"
echo ""

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${RED}ERROR: SUPABASE_PROJECT_REF not set${NC}"
    exit 1
fi

# Function to check metrics
check_metrics() {
    local PERCENT=$1
    echo -e "${YELLOW}Checking metrics at $PERCENT% traffic...${NC}"
    
    # Query Supabase logs (last 1 hour)
    echo "Error rate:"
    # Add actual Supabase API call here to get error metrics
    
    echo "Latency (p95):"
    # Add actual metric query
    
    echo "DLQ entries:"
    # Check dead letter queue
    
    echo ""
    echo "Manual verification required:"
    echo "  1. Login to Supabase Dashboard"
    echo "  2. Check Functions → wa-webhook-unified → Invocations"
    echo "  3. Verify error rate < 0.1%"
    echo "  4. Verify p95 latency < 500ms"
    echo ""
    read -p "Metrics look good? (y/n): " PROCEED
    if [ "$PROCEED" != "y" ]; then
        echo -e "${RED}Aborting migration${NC}"
        exit 1
    fi
}

echo -e "${YELLOW}=== Phase A: 10% Traffic ===${NC}"
echo "Setting FEATURE_UNIFIED_WEBHOOK_PERCENT=10"
echo "This should be done via Supabase Dashboard → Project Settings → Edge Functions → Secrets"
echo ""
echo "Add/Update: FEATURE_UNIFIED_WEBHOOK_PERCENT=10"
echo ""
read -p "Press Enter after updating environment variable..."

echo "Waiting 5 minutes for traffic to stabilize..."
sleep 300

check_metrics 10

echo ""
echo -e "${YELLOW}=== Phase B: 50% Traffic ===${NC}"
echo "Update FEATURE_UNIFIED_WEBHOOK_PERCENT=50 in Supabase Dashboard"
echo ""
read -p "Press Enter after updating to 50%..."

echo "Waiting 5 minutes for traffic to stabilize..."
sleep 300

check_metrics 50

echo ""
echo -e "${YELLOW}=== Phase C: 100% Traffic ===${NC}"
echo "Update FEATURE_UNIFIED_WEBHOOK_PERCENT=100 in Supabase Dashboard"
echo ""
read -p "Press Enter after updating to 100%..."

echo "Waiting 10 minutes for traffic to stabilize..."
sleep 600

check_metrics 100

echo ""
echo -e "${GREEN}=== Phase D: 3-Day Observation Period ===${NC}"
echo "wa-webhook-unified is now handling 100% of traffic for:"
echo "  - Property (real estate)"
echo "  - Jobs (employment)"
echo "  - Marketplace (shopping)"
echo "  - AI Agents"
echo ""
echo "Old webhook functions are still deployed as backup:"
echo "  - wa-webhook-property"
echo "  - wa-webhook-jobs"
echo "  - wa-webhook-marketplace"
echo "  - wa-webhook-ai-agents"
echo ""
echo "Next steps:"
echo "  1. Monitor for 3 days (until $(date -d '+3 days' 2>/dev/null || date -v+3d))"
echo "  2. Check daily error logs"
echo "  3. If stable, proceed to Week 7 (delete old webhooks)"
echo ""
echo "Rollback command (if needed):"
echo "  Set FEATURE_UNIFIED_WEBHOOK_PERCENT=0"
echo ""
echo -e "${GREEN}Week 6 Complete!${NC}"
