#!/bin/bash
# Phase 4: Dynamic Configuration System Setup
# Part of World-Class Repository Refactoring Plan
# Date: 2025-12-10

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "🚀 Phase 4: Dynamic Configuration Analysis"
echo "==========================================="
echo ""

echo "🔍 Searching for hardcoded configuration values..."
echo ""

# Search for common hardcoded patterns
echo "📱 Hardcoded phone numbers:"
grep -r -n "'+250[0-9]\{9\}'" --include="*.ts" --include="*.tsx" --include="*.sql" . 2>/dev/null | head -10 || echo "   None found"

echo ""
echo "💰 Hardcoded payment numbers:"
grep -r -n "'0[0-9]\{9\}'" --include="*.ts" --include="*.tsx" --include="*.sql" . 2>/dev/null | grep -i "momo\|pay" | head -5 || echo "   None found"

echo ""
echo "🔢 Hardcoded limits/defaults:"
grep -r -n "DEFAULT.*=.*[0-9]" --include="*.sql" supabase/migrations/ 2>/dev/null | head -10 || echo "   None found"

echo ""
echo "⏰ Hardcoded timeouts:"
grep -r -n "timeout.*=.*[0-9]" --include="*.ts" --include="*.tsx" . 2>/dev/null | head -5 || echo "   None found"

echo ""
echo "📊 Hardcoded radius/distance values:"
grep -r -n "radius.*=.*[0-9]" --include="*.ts" --include="*.tsx" --include="*.sql" . 2>/dev/null | head -5 || echo "   None found"

echo ""
echo "💡 Recommendations:"
echo ""
echo "1. Create @easymo/config package:"
echo "   packages/config/src/index.ts"
echo ""
echo "2. Define environment schema with Zod:"
echo "   - Core config (NODE_ENV, URLs, keys)"
echo "   - Feature flags (FEATURE_*)"
echo "   - Business limits (search radius, max results)"
echo "   - Integration config (MoMo, support contacts)"
echo ""
echo "3. Update .env.example with all config variables"
echo ""
echo "4. Replace hardcoded values with config imports:"
echo "   import { searchConfig } from '@easymo/config'"
echo ""
echo "5. Store business config in database:"
echo "   CREATE TABLE app_config (...)"
echo ""
echo "📝 Next step: Create packages/config/ with dynamic configuration"
