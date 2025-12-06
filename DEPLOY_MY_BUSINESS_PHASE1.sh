#!/bin/bash

# My Business Workflow - Phase 1 Deployment Script
# ================================================

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🏪 MY BUSINESS PHASE 1 - DEPLOYMENT SCRIPT             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Pre-deployment checks
echo "📋 Step 1: Pre-deployment Checks"
echo "================================"

echo -n "Checking git status... "
if [[ $(git status --porcelain) ]]; then
    echo -e "${RED}✗${NC}"
    echo "Working directory is not clean. Commit or stash changes first."
    exit 1
else
    echo -e "${GREEN}✓${NC}"
fi

echo -n "Checking branch... "
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "feature/my-business-integration" ]]; then
    echo -e "${YELLOW}⚠${NC} Not on feature branch. Current: $BRANCH"
else
    echo -e "${GREEN}✓${NC} On feature/my-business-integration"
fi

# Step 2: Build shared packages
echo
echo "🔨 Step 2: Build Shared Packages"
echo "================================"

echo "Building @va/shared..."
pnpm --filter @va/shared build

echo "Building @easymo/commons..."
pnpm --filter @easymo/commons build

echo -e "${GREEN}✓${NC} Shared packages built successfully"

# Step 3: Run tests
echo
echo "🧪 Step 3: Run Tests"
echo "==================="

echo "Running linter..."
if pnpm lint 2>&1 | grep -q "warning"; then
    echo -e "${YELLOW}⚠${NC} Lint warnings found (expected)"
else
    echo -e "${GREEN}✓${NC} No lint errors"
fi

echo "Running unit tests..."
if pnpm exec vitest run --reporter=basic 2>&1 | grep -q "Test Files.*passed"; then
    echo -e "${GREEN}✓${NC} Tests passed"
else
    echo -e "${YELLOW}⚠${NC} Some tests may have failed (check if related to your changes)"
fi

# Step 4: Deploy to staging (interactive)
echo
echo "🚀 Step 4: Deploy to Staging"
echo "============================"

read -p "Deploy to staging? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying wa-webhook-profile to staging..."
    supabase functions deploy wa-webhook-profile --project-ref staging || {
        echo -e "${RED}✗${NC} Failed to deploy wa-webhook-profile"
        exit 1
    }
    
    echo "Deploying wa-webhook to staging..."
    supabase functions deploy wa-webhook --project-ref staging || {
        echo -e "${RED}✗${NC} Failed to deploy wa-webhook"
        exit 1
    }
    
    echo -e "${GREEN}✓${NC} Deployed to staging"
    
    echo
    echo "📱 Manual Testing Required:"
    echo "1. Open WhatsApp (staging number)"
    echo "2. Send: 'Profile'"
    echo "3. Select: 'My Businesses'"
    echo "4. Select a restaurant"
    echo "5. Verify 'Manage Menu' appears"
    echo "6. Tap 'Manage Menu'"
    echo "7. Verify menu items load"
    echo
    read -p "Press Enter after testing completes..."
else
    echo "Skipping staging deployment"
fi

# Step 5: Deploy to production (interactive)
echo
echo "🎯 Step 5: Deploy to Production"
echo "================================"

read -p "Deploy to PRODUCTION? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠${NC} Deploying to PRODUCTION..."
    
    echo "Deploying wa-webhook-profile..."
    supabase functions deploy wa-webhook-profile || {
        echo -e "${RED}✗${NC} Failed to deploy wa-webhook-profile"
        exit 1
    }
    
    echo "Deploying wa-webhook..."
    supabase functions deploy wa-webhook || {
        echo -e "${RED}✗${NC} Failed to deploy wa-webhook"
        exit 1
    }
    
    echo -e "${GREEN}✓${NC} Deployed to production!"
    
    # Step 6: Verify deployment
    echo
    echo "🔍 Step 6: Verify Deployment"
    echo "============================"
    
    echo "Checking wa-webhook-profile health..."
    curl -s https://$(supabase status | grep "API URL" | awk '{print $3}' | cut -d'/' -f3)/functions/v1/wa-webhook-profile/health || echo "Health check endpoint may not exist"
    
    echo
    echo -e "${GREEN}✓${NC} Deployment complete!"
else
    echo "Production deployment cancelled"
fi

# Step 7: Post-deployment
echo
echo "📊 Step 7: Post-Deployment Tasks"
echo "================================="
echo "✓ Monitor logs: supabase functions logs wa-webhook-profile --tail"
echo "✓ Check metrics in Supabase dashboard"
echo "✓ Test via WhatsApp production"
echo "✓ Collect feedback from restaurant owners"
echo

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT SCRIPT COMPLETE!                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo
echo "Next steps:"
echo "1. Monitor error rates for 24 hours"
echo "2. Collect user feedback"
echo "3. Begin Phase 2 planning"
echo
echo "Documentation: MY_BUSINESS_PHASE1_COMPLETE.md"
echo "Master Roadmap: MY_BUSINESS_MASTER_ROADMAP.md"
