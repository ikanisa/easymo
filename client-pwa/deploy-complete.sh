#!/bin/bash

# EasyMO Client PWA - One-Command Deployment
# This script does EVERYTHING needed to deploy

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║     🚀 EasyMO Client PWA - Complete Deployment 🚀        ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Step counter
STEP=1
TOTAL_STEPS=8

print_step() {
    echo ""
    echo -e "${CYAN}┌─────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│ Step $STEP/$TOTAL_STEPS: $1${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────┘${NC}"
    STEP=$((STEP + 1))
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Navigate to script directory
cd "$(dirname "$0")"

print_step "Checking dependencies"

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm not found. Installing..."
    npm install -g pnpm@10.18.3
    print_success "pnpm installed"
else
    print_success "pnpm found: $(pnpm --version)"
fi

# Check for Netlify CLI
if ! command -v netlify &> /dev/null; then
    print_warning "Netlify CLI not found. Installing..."
    npm install -g netlify-cli
    print_success "Netlify CLI installed"
else
    print_success "Netlify CLI found: $(netlify --version)"
fi

print_step "Installing project dependencies"
pnpm install --frozen-lockfile
print_success "Dependencies installed"

print_step "Running type check"
if pnpm type-check; then
    print_success "Type check passed"
else
    print_error "Type check failed"
    exit 1
fi

print_step "Running linter"
if pnpm lint; then
    print_success "Lint check passed"
else
    print_warning "Lint check had warnings (proceeding anyway)"
fi

print_step "Building the project"
echo -e "${BLUE}This may take 2-3 minutes...${NC}"
if pnpm build; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    exit 1
fi

print_step "Checking build size"
BUILD_SIZE=$(du -sh .next | cut -f1)
print_success "Build size: $BUILD_SIZE"

print_step "Checking Netlify authentication"
if netlify status &> /dev/null; then
    print_success "Already authenticated with Netlify"
else
    print_warning "Not authenticated. Opening login..."
    netlify login
fi

print_step "Deploying to Netlify"
echo ""
echo -e "${YELLOW}Choose deployment target:${NC}"
echo "  1) Production (--prod)"
echo "  2) Preview/Draft"
echo ""
read -p "Enter choice (1 or 2, default=1): " DEPLOY_CHOICE
DEPLOY_CHOICE=${DEPLOY_CHOICE:-1}

if [ "$DEPLOY_CHOICE" = "1" ]; then
    echo -e "${BLUE}Deploying to PRODUCTION...${NC}"
    netlify deploy --prod --dir=.next
    DEPLOY_TYPE="PRODUCTION"
else
    echo -e "${BLUE}Deploying to PREVIEW...${NC}"
    netlify deploy --dir=.next
    DEPLOY_TYPE="PREVIEW"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║           🎉 DEPLOYMENT SUCCESSFUL! 🎉                   ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Deployment Type: $DEPLOY_TYPE${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${CYAN}📱 Next Steps:${NC}"
echo ""
echo "1. Test on Mobile Device:"
echo "   • Open site on phone browser"
echo "   • Tap 'Add to Home Screen'"
echo "   • Launch app from home screen"
echo ""
echo "2. Verify Features:"
echo "   • QR code scanning"
echo "   • Menu browsing"
echo "   • Add to cart"
echo "   • Checkout flow"
echo "   • Order tracking"
echo ""
echo "3. Run Lighthouse Audit:"
echo "   • Open site in Chrome"
echo "   • DevTools → Lighthouse"
echo "   • Run audit"
echo "   • Target: Performance 95+, PWA 100"
echo ""
echo "4. Update Environment Variable:"
echo "   • Go to Netlify Dashboard"
echo "   • Site Settings → Environment Variables"
echo "   • Update NEXT_PUBLIC_SITE_URL to your deployed URL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${CYAN}📊 Monitoring:${NC}"
echo ""
echo "• Netlify Dashboard: https://app.netlify.com"
echo "• Build Logs: Check for any warnings"
echo "• Analytics: Monitor traffic and performance"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✨ Your PWA is now live! ✨${NC}"
echo ""
echo -e "${BLUE}Made with ❤️ by the EasyMO team${NC}"
echo ""
