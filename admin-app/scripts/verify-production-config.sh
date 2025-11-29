#!/usr/bin/env bash
# Verify Production Build Configuration
# Ensures no development features leak into production builds

set -e

echo "🔍 EasyMO Admin - Production Build Verification"
echo "=============================================="
echo ""

ERRORS=0

# Check 1: Verify devtools is not in default features
echo "✓ Checking Cargo.toml for devtools..."
if grep -q 'default = \["devtools"\]' admin-app/src-tauri/Cargo.toml; then
    echo "❌ ERROR: devtools found in default features"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ devtools not in default features"
fi

# Check 2: Verify updater public key is set
echo "✓ Checking updater configuration..."
if grep -q '"pubkey": ""' admin-app/src-tauri/tauri.conf.json; then
    echo "❌ ERROR: updater pubkey is empty"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✅ updater pubkey is configured"
fi

# Check 3: Verify CSP doesn't use unsafe directives
echo "✓ Checking CSP configuration..."
if grep -q "'unsafe-eval'" admin-app/src-tauri/tauri.conf.json; then
    echo "⚠️  WARNING: CSP contains unsafe-eval"
fi
if grep -q "'unsafe-inline'" admin-app/src-tauri/tauri.conf.json; then
    echo "⚠️  WARNING: CSP contains unsafe-inline"
fi

# Check 4: Verify production identifier
echo "✓ Checking app identifier..."
if grep -q '"identifier": "dev\.easymo\.admin"' admin-app/src-tauri/tauri.conf.json; then
    echo "⚠️  WARNING: using dev identifier (should be com.easymo.admin)"
fi

# Check 5: Verify no mock data in production
echo "✓ Checking for mock data..."
if [ -f "admin-app/lib/mock-data.ts" ]; then
    SIZE=$(wc -c < admin-app/lib/mock-data.ts)
    if [ "$SIZE" -gt 10000 ]; then
        echo "  ⚠️  WARNING: Large mock data file found ($SIZE bytes)"
        echo "     Verify tree-shaking excludes it from production"
    fi
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
    echo "❌ Production build verification FAILED with $ERRORS error(s)"
    exit 1
else
    echo "✅ Production build verification PASSED"
    exit 0
fi
