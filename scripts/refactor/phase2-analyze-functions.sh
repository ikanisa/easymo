#!/bin/bash
# Phase 2: Edge Function Analysis & Consolidation Plan
# Part of World-Class Repository Refactoring Plan
# Date: 2025-12-10

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "🚀 Phase 2: Edge Function Analysis"
echo "==================================="
echo ""

FUNCTIONS_DIR="supabase/functions"

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "❌ Functions directory not found: $FUNCTIONS_DIR"
  exit 1
fi

echo "📊 Analyzing edge functions..."
echo ""

# Count total functions
TOTAL_COUNT=$(find "$FUNCTIONS_DIR" -maxdepth 1 -type d ! -name "functions" ! -name "_*" ! -name ".*" | wc -l | tr -d ' ')

echo "Total functions: $TOTAL_COUNT"
echo ""

# List webhook functions
echo "🔗 Webhook Functions:"
find "$FUNCTIONS_DIR" -maxdepth 1 -type d -name "wa-webhook-*" ! -name "*.archived" | sort | while read -r dir; do
  func_name=$(basename "$dir")
  echo "   • $func_name"
done

echo ""

# List agent functions
echo "🤖 Agent Functions:"
find "$FUNCTIONS_DIR" -maxdepth 1 -type d -name "agent-*" -o -name "*-agent" | grep -v ".archived" | sort | while read -r dir; do
  func_name=$(basename "$dir")
  echo "   • $func_name"
done

echo ""

# List admin functions
echo "⚙️  Admin Functions:"
find "$FUNCTIONS_DIR" -maxdepth 1 -type d -name "admin-*" ! -name "*.archived" | sort | while read -r dir; do
  func_name=$(basename "$dir")
  echo "   • $func_name"
done

echo ""

# Find archived functions
echo "📦 Archived Functions:"
ARCHIVED_COUNT=$(find "$FUNCTIONS_DIR" -maxdepth 1 -type d -name "*.archived" | wc -l | tr -d ' ')
echo "   Found $ARCHIVED_COUNT archived function directories"

if [ "$ARCHIVED_COUNT" -gt 0 ]; then
  echo ""
  echo "   Archived directories that can be removed:"
  find "$FUNCTIONS_DIR" -maxdepth 1 -type d -name "*.archived" | while read -r dir; do
    echo "     - $(basename "$dir")"
  done
fi

echo ""
echo "💡 Recommendations:"
echo ""
echo "1. Archive .archived directories (already backed up):"
echo "   find supabase/functions -maxdepth 1 -type d -name '*.archived' -exec rm -rf {} +"
echo ""
echo "2. Review webhook consolidation opportunities:"
echo "   • Keep domain-specific webhooks separate (mobility, insurance, property)"
echo "   • Consider merging low-traffic webhooks"
echo ""
echo "3. Review agent functions:"
echo "   • Identify duplicates or unused agents"
echo "   • Consolidate similar agent logic"
echo ""
echo "4. Create consolidation plan:"
echo "   • Document each function's purpose"
echo "   • Identify merge candidates"
echo "   • Plan deprecation timeline"
echo ""
echo "📝 Next step: Review output and create PHASE2_CONSOLIDATION_PLAN.md"
