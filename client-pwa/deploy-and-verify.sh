#!/bin/bash

# 🚀 Client PWA Deployment & Verification Script
# This script deploys the PWA and runs comprehensive checks

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║   EasyMO Client PWA Deployment & Verification  ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "app" ]; then
    log_error "Please run this script from the client-pwa directory"
    exit 1
fi

# ============================================================================
# PHASE 1: Pre-Deployment Checks
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 1: Pre-Deployment Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Node version
log_info "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    log_error "Node.js 20+ required. Current: $(node -v)"
    exit 1
fi
log_success "Node.js version OK: $(node -v)"

# Check pnpm
log_info "Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
    log_error "pnpm not found. Install with: npm install -g pnpm"
    exit 1
fi
log_success "pnpm found: $(pnpm -v)"

# Check environment variables
log_info "Checking environment variables..."
if [ ! -f ".env.local" ]; then
    log_warning ".env.local not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        log_warning "⚠️  Please update .env.local with your values before continuing"
        exit 1
    else
        log_error ".env.example not found"
        exit 1
    fi
fi
log_success "Environment file exists"

# Verify critical files
log_info "Verifying critical files..."
REQUIRED_FILES=(
    "lib/haptics.ts"
    "lib/view-transitions.ts"
    "lib/push-notifications.ts"
    "components/order/OrderTracker.tsx"
    "components/order/VoiceOrder.tsx"
    "components/payment/PaymentSelector.tsx"
    "public/manifest.json"
    "public/sw.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        log_error "Missing critical file: $file"
        exit 1
    fi
done
log_success "All critical files present"

# ============================================================================
# PHASE 2: Dependencies & Build
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 2: Dependencies & Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

log_info "Installing dependencies..."
pnpm install --frozen-lockfile
log_success "Dependencies installed"

log_info "Running TypeScript type check..."
pnpm type-check
log_success "Type check passed"

log_info "Running linter..."
pnpm lint
log_success "Linting passed"

log_info "Building for production..."
pnpm build
log_success "Build completed"

# ============================================================================
# PHASE 3: Build Verification
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 3: Build Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check build output
log_info "Verifying build output..."
if [ ! -d ".next" ]; then
    log_error "Build directory .next not found"
    exit 1
fi
log_success "Build directory exists"

# Check PWA assets
log_info "Verifying PWA assets..."
if [ ! -f "public/manifest.json" ]; then
    log_error "PWA manifest missing"
    exit 1
fi
if [ ! -f "public/sw.js" ]; then
    log_error "Service worker missing"
    exit 1
fi
log_success "PWA assets present"

# Check bundle size
log_info "Analyzing bundle size..."
BUILD_SIZE=$(du -sh .next | cut -f1)
log_info "Build size: $BUILD_SIZE"

# ============================================================================
# PHASE 4: Deployment
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 4: Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    log_warning "Netlify CLI not found. Installing..."
    npm install -g netlify-cli
fi

# Check Netlify authentication
log_info "Checking Netlify authentication..."
if ! netlify status &> /dev/null; then
    log_warning "Not logged in to Netlify. Running login..."
    netlify login
fi

log_info "Deploying to Netlify..."
netlify deploy --prod --dir=.next

DEPLOYMENT_URL=$(netlify status --json 2>/dev/null | grep -o '"url":"[^"]*' | cut -d'"' -f4 | head -1)

if [ -z "$DEPLOYMENT_URL" ]; then
    log_error "Failed to get deployment URL"
    exit 1
fi

log_success "Deployed to: $DEPLOYMENT_URL"

# ============================================================================
# PHASE 5: Post-Deployment Verification
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 5: Post-Deployment Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

log_info "Waiting for deployment to propagate (10s)..."
sleep 10

# Check if site is accessible
log_info "Checking site accessibility..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL" || echo "000")

if [ "$HTTP_STATUS" -eq 200 ]; then
    log_success "Site is accessible (HTTP $HTTP_STATUS)"
else
    log_error "Site returned HTTP $HTTP_STATUS"
fi

# Check PWA manifest
log_info "Checking PWA manifest..."
MANIFEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/manifest.json" || echo "000")

if [ "$MANIFEST_STATUS" -eq 200 ]; then
    log_success "PWA manifest accessible"
else
    log_warning "PWA manifest check failed (HTTP $MANIFEST_STATUS)"
fi

# Check service worker
log_info "Checking service worker..."
SW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/sw.js" || echo "000")

if [ "$SW_STATUS" -eq 200 ]; then
    log_success "Service worker accessible"
else
    log_warning "Service worker check failed (HTTP $SW_STATUS)"
fi

# ============================================================================
# PHASE 6: Summary
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DEPLOYMENT SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

log_success "Deployment completed successfully!"
echo ""
echo "📱 PWA URL: $DEPLOYMENT_URL"
echo "📋 Manifest: $DEPLOYMENT_URL/manifest.json"
echo "⚙️  Service Worker: $DEPLOYMENT_URL/sw.js"
echo ""

log_info "Next Steps:"
echo "1. Test PWA installation on mobile device"
echo "2. Scan QR codes to verify venue access"
echo "3. Place test order and verify payment flow"
echo "4. Check order tracking real-time updates"
echo "5. Test voice ordering feature"
echo "6. Verify push notifications"
echo ""

log_info "Run Lighthouse Audit:"
echo "lighthouse $DEPLOYMENT_URL --output html --output-path ./lighthouse-report.html"
echo ""

log_info "Monitor deployment:"
echo "netlify watch"
echo ""

log_success "🎉 Client PWA is live and ready!"
