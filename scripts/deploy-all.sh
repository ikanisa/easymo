#!/bin/bash
# Deploy all WhatsApp webhook microservices
# Run from repository root

set -e

echo "🚀 EasyMO WhatsApp Webhook Deployment"
echo "======================================"
echo ""

# Configuration
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-lhbowpbcpwoiparwnwgt}"
SERVICES=("wa-webhook-core" "wa-webhook-profile" "wa-webhook-mobility" "wa-webhook-insurance")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track deployment status
declare -A DEPLOY_STATUS

# Function to deploy a service
deploy_service() {
    local service=$1
    echo ""
    echo -e "${BLUE}📦 Deploying ${service}...${NC}"
    echo "----------------------------------------"
    
    # Check if function exists
    if [ ! -d "supabase/functions/${service}" ]; then
        echo -e "${RED}❌ Function directory not found: supabase/functions/${service}${NC}"
        DEPLOY_STATUS[$service]="FAILED"
        return 1
    fi
    
    # Check for backup files
    local backups=$(find "supabase/functions/${service}" -name "*.bak*" -type f 2>/dev/null | wc -l)
    if [ "$backups" -gt 0 ]; then
        echo -e "${YELLOW}⚠️ Warning: ${backups} backup file(s) found in ${service}${NC}"
        echo "   Run scripts/phase1-cleanup.sh first!"
    fi
    
    # Type check
    echo "   Running type check..."
    if ! deno check "supabase/functions/${service}/index.ts" 2>/dev/null; then
        echo -e "${YELLOW}⚠️ Type check warnings (continuing anyway)${NC}"
    fi
    
    # Deploy
    echo "   Deploying to Supabase..."
    if supabase functions deploy "${service}" --no-verify-jwt --project-ref "${SUPABASE_PROJECT_REF}"; then
        DEPLOY_STATUS[$service]="SUCCESS"
        echo -e "${GREEN}✅ ${service} deployed successfully${NC}"
    else
        DEPLOY_STATUS[$service]="FAILED"
        echo -e "${RED}❌ ${service} deployment failed${NC}"
        return 1
    fi
}

# Function to verify health
verify_health() {
    local service=$1
    local base_url="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1"
    
    echo "   Checking health endpoint..."
    local response=$(curl -s -w "\n%{http_code}" "${base_url}/${service}/health" 2>/dev/null)
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        local status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$status" = "healthy" ]; then
            echo -e "${GREEN}   ✓ Health check passed (status: ${status})${NC}"
            return 0
        else
            echo -e "${YELLOW}   ⚠️ Health check returned: ${status}${NC}"
            return 1
        fi
    else
        echo -e "${RED}   ❌ Health check failed (HTTP ${http_code})${NC}"
        return 1
    fi
}

# Pre-deployment checks
echo "📋 Pre-deployment Checks"
echo "------------------------"

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Install with: npm install -g supabase${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Supabase CLI found${NC}"

# Check Deno
if ! command -v deno &> /dev/null; then
    echo -e "${RED}❌ Deno not found. Install from: https://deno.land${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Deno found${NC}"

# Check login status
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Supabase. Run: supabase login${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Supabase authenticated${NC}"

# Run cleanup first
echo ""
echo "🧹 Running cleanup..."
if [ -f "scripts/phase1-cleanup.sh" ]; then
    bash scripts/phase1-cleanup.sh
else
    echo -e "${YELLOW}⚠️ Cleanup script not found, skipping...${NC}"
fi

# Deploy services in order
echo ""
echo "🚀 Deploying Services"
echo "---------------------"

for service in "${SERVICES[@]}"; do
    deploy_service "$service"
done

# Verify all deployments
echo ""
echo "🔍 Verifying Deployments"
echo "------------------------"

HEALTH_FAILURES=0
for service in "${SERVICES[@]}"; do
    if [ "${DEPLOY_STATUS[$service]}" = "SUCCESS" ]; then
        echo -e "${BLUE}Verifying ${service}...${NC}"
        if ! verify_health "$service"; then
            ((HEALTH_FAILURES++))
        fi
    fi
done

# Summary
echo ""
echo "======================================"
echo "📊 Deployment Summary"
echo "======================================"

for service in "${SERVICES[@]}"; do
    local status="${DEPLOY_STATUS[$service]}"
    if [ "$status" = "SUCCESS" ]; then
        echo -e "   ${service}: ${GREEN}✅ SUCCESS${NC}"
    else
        echo -e "   ${service}: ${RED}❌ FAILED${NC}"
    fi
done

if [ "$HEALTH_FAILURES" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️ ${HEALTH_FAILURES} health check(s) need attention${NC}"
fi

echo ""
echo "🔗 Health Check URLs:"
for service in "${SERVICES[@]}"; do
    echo "   https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${service}/health"
done

# Final status
FAILED_COUNT=0
for service in "${SERVICES[@]}"; do
    if [ "${DEPLOY_STATUS[$service]}" != "SUCCESS" ]; then
        ((FAILED_COUNT++))
    fi
done

echo ""
if [ "$FAILED_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ All deployments successful!${NC}"
    exit 0
else
    echo -e "${RED}❌ ${FAILED_COUNT} deployment(s) failed${NC}"
    exit 1
fi
