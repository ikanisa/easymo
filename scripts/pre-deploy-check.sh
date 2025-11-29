#!/bin/bash
# EasyMO Admin Panel - Pre-Deployment Validation Script
# Run this before deploying to Netlify to catch issues early

set -e  # Exit on any error

echo "🚀 EasyMO Pre-Deployment Validation"
echo "===================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ERRORS=0
WARNINGS=0

# Helper functions
error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ERRORS=$((ERRORS + 1))
}

warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo "ℹ️  $1"
}

# 1. Check Node.js version
echo "1️⃣  Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_NODE="20.18.0"
if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE" ]; then
    success "Node.js version: $NODE_VERSION (>= $REQUIRED_NODE)"
else
    error "Node.js version $NODE_VERSION is below required $REQUIRED_NODE"
fi
echo ""

# 2. Check pnpm version
echo "2️⃣  Checking pnpm version..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    if [ "$(printf '%s\n' "10.18.3" "$PNPM_VERSION" | sort -V | head -n1)" = "10.18.3" ]; then
        success "pnpm version: $PNPM_VERSION (>= 10.18.3)"
    else
        error "pnpm version $PNPM_VERSION is below required 10.18.3"
    fi
else
    error "pnpm is not installed. Run: npm install -g pnpm@10.18.3"
fi
echo ""

# 3. Check if in correct directory
echo "3️⃣  Checking repository structure..."
if [ ! -f "package.json" ] || [ ! -d "admin-app" ]; then
    error "Must be run from repository root containing admin-app/"
else
    success "Repository structure valid"
fi
echo ""

# 4. Install dependencies
echo "4️⃣  Installing dependencies..."
if pnpm install --frozen-lockfile --silent; then
    success "Dependencies installed"
else
    error "Dependency installation failed"
fi
echo ""

# 5. Build shared packages
echo "5️⃣  Building shared packages..."
PACKAGES=("@va/shared" "@easymo/commons" "@easymo/video-agent-schema" "@easymo/ui")
for pkg in "${PACKAGES[@]}"; do
    info "Building $pkg..."
    if pnpm --filter "$pkg" build &> /dev/null; then
        success "$pkg built successfully"
    else
        error "Failed to build $pkg"
    fi
done
echo ""

# 6. Security checks
echo "6️⃣  Running security checks..."
info "Checking for service role keys in client code..."
if node ./scripts/assert-no-service-role-in-client.mjs; then
    success "No service role keys in client code"
else
    error "Service role key found in client environment variables!"
fi

info "Checking admin app mocks..."
if node ./scripts/assert-no-mocks-in-admin.mjs; then
    success "No mocks enabled in admin app"
else
    error "Mocks are enabled in admin app!"
fi

info "Checking inventory app deferral..."
if node ./scripts/assert-inventory-app-deferred.mjs; then
    success "Inventory app properly deferred"
else
    warning "Inventory app deferral check failed (non-critical)"
fi
echo ""

# 7. Environment variables check
echo "7️⃣  Checking environment variables..."
REQUIRED_ENV_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

cd admin-app
for var in "${REQUIRED_ENV_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        warning "Environment variable $var is not set (OK if in Netlify dashboard)"
    else
        success "Environment variable $var is set"
    fi
done
cd ..
echo ""

# 8. Linting
echo "8️⃣  Running linters..."
cd admin-app
if npm run lint -- --quiet; then
    success "Linting passed"
else
    error "Linting failed"
fi
cd ..
echo ""

# 9. Type checking
echo "9️⃣  Running TypeScript type check..."
cd admin-app
if npm run type-check; then
    success "Type checking passed"
else
    error "Type checking failed"
fi
cd ..
echo ""

# 10. Unit tests
echo "🔟 Running unit tests..."
cd admin-app
if npm test -- --run --silent; then
    success "Unit tests passed"
else
    error "Unit tests failed"
fi
cd ..
echo ""

# 11. Build test
echo "1️⃣1️⃣  Testing production build..."
cd admin-app
if NODE_ENV=production npm run build; then
    success "Production build successful"
else
    error "Production build failed"
fi
cd ..
echo ""

# 12. Database migration check
echo "1️⃣2️⃣  Checking database migrations..."
if command -v supabase &> /dev/null; then
    info "Checking migration status..."
    if supabase db diff --use-migra; then
        success "Database migrations in sync"
    else
        warning "Database may have pending migrations"
    fi
else
    warning "Supabase CLI not installed, skipping migration check"
fi
echo ""

# Summary
echo ""
echo "======================================"
echo "📊 VALIDATION SUMMARY"
echo "======================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo "Ready to deploy to Netlify."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  PASSED WITH $WARNINGS WARNING(S)${NC}"
    echo "You can proceed with deployment, but review warnings."
    exit 0
else
    echo -e "${RED}❌ FAILED WITH $ERRORS ERROR(S) AND $WARNINGS WARNING(S)${NC}"
    echo "Fix errors before deploying to Netlify."
    exit 1
fi
