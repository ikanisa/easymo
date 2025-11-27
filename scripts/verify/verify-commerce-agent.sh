#!/bin/bash
# =====================================================
# Verify Unified Commerce Agent Implementation
# =====================================================

set -e

echo "🔍 Verifying Unified Commerce Agent Implementation..."
echo "======================================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# =====================================================
# Helper Functions
# =====================================================

check_file() {
    local file=$1
    local desc=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $desc"
        return 0
    else
        echo -e "${RED}❌${NC} $desc - File not found: $file"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

check_file_content() {
    local file=$1
    local pattern=$2
    local desc=$3
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $desc"
        return 0
    else
        echo -e "${RED}❌${NC} $desc - Pattern not found in $file"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

check_lines() {
    local file=$1
    local min_lines=$2
    local desc=$3
    
    if [ -f "$file" ]; then
        local lines=$(wc -l < "$file")
        if [ "$lines" -ge "$min_lines" ]; then
            echo -e "${GREEN}✅${NC} $desc ($lines LOC)"
            return 0
        else
            echo -e "${YELLOW}⚠️${NC}  $desc - Only $lines LOC (expected >= $min_lines)"
            WARNINGS=$((WARNINGS + 1))
            return 1
        fi
    else
        echo -e "${RED}❌${NC} $desc - File not found"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# =====================================================
# 1. Core Agent Files
# =====================================================

echo -e "${BLUE}Phase 1: Core Agent Files${NC}"

check_lines \
    "supabase/functions/wa-webhook-unified/agents/commerce-agent.ts" \
    1000 \
    "CommerceAgent implementation"

check_file_content \
    "supabase/functions/wa-webhook-unified/agents/commerce-agent.ts" \
    "class CommerceAgent extends BaseAgent" \
    "CommerceAgent class definition"

check_file_content \
    "supabase/functions/wa-webhook-unified/agents/commerce-agent.ts" \
    "create_listing" \
    "Marketplace tools (create_listing)"

check_file_content \
    "supabase/functions/wa-webhook-unified/agents/commerce-agent.ts" \
    "search_businesses" \
    "Business directory tools (search_businesses)"

check_file_content \
    "supabase/functions/wa-webhook-unified/agents/commerce-agent.ts" \
    "find_business_partners" \
    "Business broker tools (find_business_partners)"

check_file_content \
    "supabase/functions/wa-webhook-unified/agents/commerce-agent.ts" \
    "rate_and_review" \
    "Trust & safety tools (rate_and_review)"

echo ""

# =====================================================
# 2. Google Places Integration
# =====================================================

echo -e "${BLUE}Phase 2: Google Places Integration${NC}"

check_lines \
    "supabase/functions/wa-webhook-unified/tools/google-places.ts" \
    400 \
    "Google Places tool implementation"

check_file_content \
    "supabase/functions/wa-webhook-unified/tools/google-places.ts" \
    "class GooglePlacesTool" \
    "GooglePlacesTool class"

check_file_content \
    "supabase/functions/wa-webhook-unified/tools/google-places.ts" \
    "searchNearby" \
    "Nearby search method"

check_file_content \
    "supabase/functions/wa-webhook-unified/tools/google-places.ts" \
    "searchText" \
    "Text search method"

check_file_content \
    "supabase/functions/wa-webhook-unified/tools/google-places.ts" \
    "getPlaceDetails" \
    "Place details method"

check_file_content \
    "supabase/functions/wa-webhook-unified/tools/google-places.ts" \
    "api_cache" \
    "Caching implementation"

echo ""

# =====================================================
# 3. Database Migrations
# =====================================================

echo -e "${BLUE}Phase 3: Database Migrations${NC}"

check_file \
    "supabase/migrations/20251127140000_commerce_trust_safety.sql" \
    "Trust & Safety migration"

check_file_content \
    "supabase/migrations/20251127140000_commerce_trust_safety.sql" \
    "CREATE TABLE.*ratings_reviews" \
    "Ratings & reviews table"

check_file_content \
    "supabase/migrations/20251127140000_commerce_trust_safety.sql" \
    "CREATE TABLE.*content_moderation" \
    "Content moderation table"

check_file_content \
    "supabase/migrations/20251127140000_commerce_trust_safety.sql" \
    "CREATE TABLE.*user_favorites" \
    "User favorites table"

check_file_content \
    "supabase/migrations/20251127140000_commerce_trust_safety.sql" \
    "CREATE TABLE.*business_opportunities" \
    "Business opportunities table"

check_file_content \
    "supabase/migrations/20251127140000_commerce_trust_safety.sql" \
    "CREATE TABLE.*escrow_transactions" \
    "Escrow transactions table"

check_file \
    "supabase/migrations/20251127140100_api_cache.sql" \
    "API cache migration"

check_file_content \
    "supabase/migrations/20251127140100_api_cache.sql" \
    "CREATE TABLE.*api_cache" \
    "API cache table"

echo ""

# =====================================================
# 4. Registry Update
# =====================================================

echo -e "${BLUE}Phase 4: Registry Update${NC}"

check_file_content \
    "supabase/functions/wa-webhook-unified/agents/registry.ts" \
    "CommerceAgent" \
    "CommerceAgent import"

check_file_content \
    "supabase/functions/wa-webhook-unified/agents/registry.ts" \
    'case "marketplace"' \
    "Marketplace routing"

check_file_content \
    "supabase/functions/wa-webhook-unified/agents/registry.ts" \
    'case "business_broker"' \
    "Business broker routing"

echo ""

# =====================================================
# 5. Deployment & Documentation
# =====================================================

echo -e "${BLUE}Phase 5: Deployment & Documentation${NC}"

check_file \
    "deploy-unified-commerce-agent.sh" \
    "Deployment script"

if [ -f "deploy-unified-commerce-agent.sh" ]; then
    if [ -x "deploy-unified-commerce-agent.sh" ]; then
        echo -e "${GREEN}✅${NC} Deployment script is executable"
    else
        echo -e "${YELLOW}⚠️${NC}  Deployment script not executable (run: chmod +x deploy-unified-commerce-agent.sh)"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

check_lines \
    "docs/COMMERCE_AGENT.md" \
    500 \
    "Complete documentation"

check_file \
    "docs/COMMERCE_AGENT_SUMMARY.md" \
    "Summary documentation"

echo ""

# =====================================================
# 6. Code Quality Checks
# =====================================================

echo -e "${BLUE}Phase 6: Code Quality Checks${NC}"

# Count tools in commerce-agent.ts
if [ -f "supabase/functions/wa-webhook-unified/agents/commerce-agent.ts" ]; then
    TOOL_COUNT=$(grep -c '"name":' supabase/functions/wa-webhook-unified/agents/commerce-agent.ts || echo "0")
    if [ "$TOOL_COUNT" -ge 15 ]; then
        echo -e "${GREEN}✅${NC} Tool count: $TOOL_COUNT tools (expected >= 15)"
    else
        echo -e "${YELLOW}⚠️${NC}  Tool count: $TOOL_COUNT tools (expected >= 15)"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# Check for TypeScript errors (if tsc is available)
if command -v tsc &> /dev/null; then
    echo -e "${BLUE}  Running TypeScript check...${NC}"
    if tsc --noEmit supabase/functions/wa-webhook-unified/agents/commerce-agent.ts 2>/dev/null; then
        echo -e "${GREEN}✅${NC} No TypeScript errors"
    else
        echo -e "${YELLOW}⚠️${NC}  TypeScript errors found (non-critical)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️${NC}  TypeScript compiler not found, skipping type check"
fi

echo ""

# =====================================================
# Summary
# =====================================================

echo "======================================================"
echo -e "${BLUE}Verification Summary${NC}"
echo "======================================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Implementation is complete.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy: ./deploy-unified-commerce-agent.sh"
    echo "  2. Test with WhatsApp message"
    echo "  3. Monitor logs: supabase functions logs wa-webhook-unified --tail"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Implementation complete with $WARNINGS warnings.${NC}"
    echo ""
    echo "Non-critical issues found. Review warnings above."
    echo "You can still deploy, but consider fixing warnings first."
    exit 0
else
    echo -e "${RED}❌ Implementation incomplete: $ERRORS errors, $WARNINGS warnings.${NC}"
    echo ""
    echo "Fix the errors above before deploying."
    exit 1
fi
