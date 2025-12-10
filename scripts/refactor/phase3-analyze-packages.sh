#!/bin/bash
# Phase 3: Package Consolidation Analysis
# Part of World-Class Repository Refactoring Plan
# Date: 2025-12-10

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "🚀 Phase 3: Package Analysis"
echo "============================="
echo ""

PACKAGES_DIR="packages"

if [ ! -d "$PACKAGES_DIR" ]; then
  echo "❌ Packages directory not found: $PACKAGES_DIR"
  exit 1
fi

echo "📊 Analyzing packages..."
echo ""

# Count total packages
TOTAL_COUNT=$(find "$PACKAGES_DIR" -maxdepth 1 -type d ! -name "packages" ! -name ".*" | wc -l | tr -d ' ')

echo "Total packages: $TOTAL_COUNT"
echo ""

# Group similar packages
echo "🎯 Package Consolidation Opportunities:"
echo ""

echo "📦 Localization/i18n (MERGE CANDIDATES):"
find "$PACKAGES_DIR" -maxdepth 1 -type d \( -name "*local*" -o -name "*i18n*" \) | while read -r dir; do
  pkg_name=$(basename "$dir")
  echo "   • $pkg_name"
done

echo ""
echo "🎨 UI Components (MERGE CANDIDATES):"
find "$PACKAGES_DIR" -maxdepth 1 -type d \( -name "*ui" -o -name "*component*" \) | while read -r dir; do
  pkg_name=$(basename "$dir")
  echo "   • $pkg_name"
done

echo ""
echo "🤖 AI/Agent Logic (MERGE CANDIDATES):"
find "$PACKAGES_DIR" -maxdepth 1 -type d \( -name "*ai*" -o -name "*agent*" \) | while read -r dir; do
  pkg_name=$(basename "$dir")
  echo "   • $pkg_name"
done

echo ""
echo "⚙️  Configuration (MERGE CANDIDATES):"
find "$PACKAGES_DIR" -maxdepth 1 -type d \( -name "*config*" -o -name "*flag*" \) | while read -r dir; do
  pkg_name=$(basename "$dir")
  echo "   • $pkg_name"
done

echo ""
echo "🗄️  Database/Schemas (MERGE CANDIDATES):"
find "$PACKAGES_DIR" -maxdepth 1 -type d \( -name "*schema*" -o -name "*db*" \) | while read -r dir; do
  pkg_name=$(basename "$dir")
  echo "   • $pkg_name"
done

echo ""
echo "🔧 Shared/Common (MERGE CANDIDATES):"
find "$PACKAGES_DIR" -maxdepth 1 -type d \( -name "*shared*" -o -name "*common*" -o -name "*type*" \) | while read -r dir; do
  pkg_name=$(basename "$dir")
  echo "   • $pkg_name"
done

echo ""
echo "🏢 Ibimina-specific packages:"
find "$PACKAGES_DIR" -maxdepth 1 -type d -name "ibimina-*" | while read -r dir; do
  pkg_name=$(basename "$dir")
  echo "   • $pkg_name"
done

echo ""
echo "💡 Target Package Structure:"
echo ""
echo "packages/"
echo "├── commons/          # Merge: shared, types, commons"
echo "├── ui/               # Merge: ui, ibimina-ui"
echo "├── db/               # Keep as is"
echo "├── ai/               # Merge: ai, ai-core, agents, agent-config"
echo "├── messaging/        # Keep as is"
echo "├── localization/     # Merge: locales, localization, ibimina-locales"
echo "├── config/           # Merge: flags, ibimina-flags, ibimina-config"
echo "├── schemas/          # Merge: supabase-schemas, ibimina-supabase-schemas"
echo "└── [domain-specific]/ # Keep specialized packages"
echo ""
echo "📋 Consolidation Strategy:"
echo ""
echo "1. Create migration plan for each merge group"
echo "2. Update import paths across codebase"
echo "3. Merge package.json dependencies"
echo "4. Update tsconfig references"
echo "5. Test thoroughly before deletion"
echo "6. Archive old packages"
echo ""
echo "⚠️  HIGH RISK CHANGES - Requires careful dependency analysis!"
echo ""
echo "📝 Next step: Create detailed PHASE3_PACKAGE_MERGE_PLAN.md"
