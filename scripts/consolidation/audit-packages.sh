#!/bin/bash
# Package Consolidation Audit Script
# Analyzes all packages and identifies duplicates

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

AUDIT_DIR="$REPO_ROOT/.consolidation-audit/packages-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$AUDIT_DIR"

echo "========================================"
echo "Package Consolidation Audit"
echo "========================================"
echo "Audit directory: $AUDIT_DIR"
echo ""

# Initialize report
cat > "$AUDIT_DIR/audit-report.md" << 'HEADER'
# Package Consolidation Audit Report

**Date:** $(date)

## Package Inventory

HEADER

echo "📋 Analyzing packages..."
echo ""

TOTAL_PACKAGES=0
DUPLICATE_CATEGORIES=0

# Analyze each package
for pkg in packages/*/; do
  if [ ! -d "$pkg" ]; then
    continue
  fi
  
  pkg_name=$(basename "$pkg")
  TOTAL_PACKAGES=$((TOTAL_PACKAGES + 1))
  
  echo "### Package: $pkg_name" >> "$AUDIT_DIR/audit-report.md"
  
  if [ -f "$pkg/package.json" ]; then
    npm_name=$(jq -r .name "$pkg/package.json" 2>/dev/null || echo "N/A")
    files=$(find "$pkg" -type f 2>/dev/null | wc -l | tr -d ' ')
    size=$(du -sh "$pkg" 2>/dev/null | cut -f1)
    
    echo "- **NPM Name:** \`$npm_name\`" >> "$AUDIT_DIR/audit-report.md"
    echo "- **Files:** $files" >> "$AUDIT_DIR/audit-report.md"
    echo "- **Size:** $size" >> "$AUDIT_DIR/audit-report.md"
    
    # Check for duplicates
    if [[ "$pkg_name" == *"ibimina"* ]]; then
      base_name=$(echo "$pkg_name" | sed 's/ibimina-//')
      if [ -d "packages/$base_name" ]; then
        echo "- **⚠️ DUPLICATE:** Has generic version at \`packages/$base_name\`" >> "$AUDIT_DIR/audit-report.md"
        DUPLICATE_CATEGORIES=$((DUPLICATE_CATEGORIES + 1))
      fi
    fi
    
    # Find imports
    import_count=$(grep -r "from ['\"]@.*$pkg_name" . \
      --include="*.ts" --include="*.tsx" \
      --exclude-dir="node_modules" --exclude-dir=".next" \
      --exclude-dir="dist" --exclude-dir="build" \
      2>/dev/null | wc -l | tr -d ' ')
    
    echo "- **Import Usage:** $import_count locations" >> "$AUDIT_DIR/audit-report.md"
  else
    echo "- **Status:** No package.json found" >> "$AUDIT_DIR/audit-report.md"
  fi
  
  echo "" >> "$AUDIT_DIR/audit-report.md"
  
  echo "  ✓ Analyzed $pkg_name"
done

echo ""
echo "📊 Summary Statistics" | tee -a "$AUDIT_DIR/audit-report.md"
echo "" | tee -a "$AUDIT_DIR/audit-report.md"
echo "## Summary" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"
echo "- **Total Packages:** $TOTAL_PACKAGES" | tee -a "$AUDIT_DIR/audit-report.md"
echo "- **Duplicate Categories Found:** $DUPLICATE_CATEGORIES" | tee -a "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"

# Categorize duplicates
echo "## Duplicate Analysis" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"

echo "### UI Packages" >> "$AUDIT_DIR/audit-report.md"
for pkg in packages/*ui*/; do
  if [ -d "$pkg" ]; then
    echo "- \`$(basename "$pkg")\`" >> "$AUDIT_DIR/audit-report.md"
  fi
done
echo "" >> "$AUDIT_DIR/audit-report.md"

echo "### Localization Packages" >> "$AUDIT_DIR/audit-report.md"
for pkg in packages/*locale*/; do
  if [ -d "$pkg" ]; then
    echo "- \`$(basename "$pkg")\`" >> "$AUDIT_DIR/audit-report.md"
  fi
done
echo "" >> "$AUDIT_DIR/audit-report.md"

echo "### Configuration Packages" >> "$AUDIT_DIR/audit-report.md"
for pkg in packages/*config* packages/*flag*/; do
  if [ -d "$pkg" ]; then
    echo "- \`$(basename "$pkg")\`" >> "$AUDIT_DIR/audit-report.md"
  fi
done
echo "" >> "$AUDIT_DIR/audit-report.md"

echo "### Schema Packages" >> "$AUDIT_DIR/audit-report.md"
for pkg in packages/*schema*/; do
  if [ -d "$pkg" ]; then
    echo "- \`$(basename "$pkg")\`" >> "$AUDIT_DIR/audit-report.md"
  fi
done
echo "" >> "$AUDIT_DIR/audit-report.md"

# Recommendations
echo "## Consolidation Recommendations" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"
echo "### Priority 1: UI Packages" >> "$AUDIT_DIR/audit-report.md"
echo "- **Action:** Merge \`ibimina-ui\` into \`ui\`" >> "$AUDIT_DIR/audit-report.md"
echo "- **Impact:** Reduce UI packages from 2+ to 1" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"

echo "### Priority 2: Localization" >> "$AUDIT_DIR/audit-report.md"
echo "- **Action:** Merge \`ibimina-locales\` into \`locales\`" >> "$AUDIT_DIR/audit-report.md"
echo "- **Impact:** Reduce locale packages from 2+ to 1" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"

echo "### Priority 3: Configuration" >> "$AUDIT_DIR/audit-report.md"
echo "- **Action:** Merge flag packages, consolidate config" >> "$AUDIT_DIR/audit-report.md"
echo "- **Impact:** Reduce config packages from 4+ to 2" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"

echo ""
echo "✅ Audit complete!"
echo ""
echo "📊 Report: $AUDIT_DIR/audit-report.md"
echo "📁 Audit data: $AUDIT_DIR/"
echo ""
echo "Next steps:"
echo "1. Review the audit report"
echo "2. Plan consolidation strategy"
echo "3. Execute consolidation by category"
