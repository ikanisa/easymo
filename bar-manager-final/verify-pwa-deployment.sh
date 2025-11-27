#!/bin/bash
# PWA Deployment Verification Script
# Run after Netlify deployment to verify PWA setup

set -e

SITE_URL="${1:-https://admin.easymo.dev}"
echo "🔍 Verifying PWA deployment at: $SITE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check manifest
echo "📱 Checking Web App Manifest..."
MANIFEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/manifest.webmanifest")
if [ "$MANIFEST_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} Manifest accessible (200 OK)"
    
    # Check Content-Type
    MANIFEST_TYPE=$(curl -s -I "$SITE_URL/manifest.webmanifest" | grep -i "content-type" | awk '{print $2}' | tr -d '\r')
    if [[ "$MANIFEST_TYPE" == *"application/manifest+json"* ]]; then
        echo -e "${GREEN}✓${NC} Correct Content-Type: $MANIFEST_TYPE"
    else
        echo -e "${YELLOW}⚠${NC} Warning: Content-Type is $MANIFEST_TYPE (expected application/manifest+json)"
    fi
else
    echo -e "${RED}✗${NC} Manifest not accessible (HTTP $MANIFEST_STATUS)"
fi
echo ""

# Check Service Worker
echo "⚙️  Checking Service Worker..."
SW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/sw.v4.js")
if [ "$SW_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} Service Worker accessible (200 OK)"
    
    # Check Service-Worker-Allowed header
    SW_ALLOWED=$(curl -s -I "$SITE_URL/sw.v4.js" | grep -i "service-worker-allowed" | awk '{print $2}' | tr -d '\r')
    if [ ! -z "$SW_ALLOWED" ]; then
        echo -e "${GREEN}✓${NC} Service-Worker-Allowed: $SW_ALLOWED"
    else
        echo -e "${YELLOW}⚠${NC} Service-Worker-Allowed header not found"
    fi
else
    echo -e "${RED}✗${NC} Service Worker not accessible (HTTP $SW_STATUS)"
fi
echo ""

# Check offline page
echo "📴 Checking Offline Page..."
OFFLINE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/offline.html")
if [ "$OFFLINE_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} Offline page accessible (200 OK)"
else
    echo -e "${RED}✗${NC} Offline page not accessible (HTTP $OFFLINE_STATUS)"
fi
echo ""

# Check security headers
echo "🔒 Checking Security Headers..."
HEADERS=$(curl -s -I "$SITE_URL")

check_header() {
    local header_name=$1
    local expected=$2
    if echo "$HEADERS" | grep -qi "$header_name"; then
        local value=$(echo "$HEADERS" | grep -i "$header_name" | head -1 | cut -d':' -f2- | tr -d '\r' | xargs)
        echo -e "${GREEN}✓${NC} $header_name: $value"
    else
        echo -e "${RED}✗${NC} $header_name header not found"
    fi
}

check_header "X-Frame-Options" "DENY"
check_header "X-Content-Type-Options" "nosniff"
check_header "Strict-Transport-Security" "max-age"
check_header "Referrer-Policy" "strict-origin"
echo ""

# Check icons
echo "🎨 Checking PWA Icons..."
ICONS=(
    "icon-192.png"
    "icon-512.png"
    "icon-maskable-512.png"
)

for icon in "${ICONS[@]}"; do
    ICON_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/icons/$icon")
    if [ "$ICON_STATUS" = "200" ]; then
        echo -e "${GREEN}✓${NC} /icons/$icon (200 OK)"
    else
        echo -e "${RED}✗${NC} /icons/$icon (HTTP $ICON_STATUS)"
    fi
done
echo ""

# Check screenshots
echo "📸 Checking PWA Screenshots..."
SCREENSHOTS=(
    "dashboard-wide.png"
    "dashboard-narrow.png"
)

for screenshot in "${SCREENSHOTS[@]}"; do
    SCREENSHOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/screenshots/$screenshot")
    if [ "$SCREENSHOT_STATUS" = "200" ]; then
        echo -e "${GREEN}✓${NC} /screenshots/$screenshot (200 OK)"
    else
        echo -e "${YELLOW}⚠${NC} /screenshots/$screenshot (HTTP $SCREENSHOT_STATUS) - Optional"
    fi
done
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 PWA Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Run Lighthouse audit in Chrome DevTools"
echo "2. Test PWA installation on desktop and mobile"
echo "3. Test offline mode by disabling network"
echo "4. Verify background sync with offline POST requests"
echo ""
echo "For detailed checklist, see: admin-app/PWA_DEPLOYMENT_CHECKLIST.md"
echo ""
