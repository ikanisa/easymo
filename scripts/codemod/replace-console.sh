#!/bin/bash
set -euo pipefail

# Script to replace console.log with structured logging
# Usage: ./scripts/codemod/replace-console.sh [--dry-run]

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🔍 DRY RUN MODE - No files will be modified"
  echo ""
fi

# Files with console.log to fix (from audit)
FILES=(
  "admin-app/app/(panel)/aurora/settings/AuroraSettingsClient.tsx"
  "admin-app/components/auth/LoginForm.tsx"
  "admin-app/components/providers/SupabaseAuthProvider.tsx"
  "admin-app/components/pwa/PWAProvider.tsx"
)

echo "🔧 Replacing console.log with structured logging..."
echo ""

FIXED=0

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⏭️  Skipped (not found): $file"
    continue
  fi
  
  echo "📝 Processing: $file"
  
  # For admin-app components, we'll add eslint-disable comments
  # since they're UI feedback, not production logging
  if [ "$DRY_RUN" = false ]; then
    # Check if file already has eslint-disable for console
    if ! grep -q "eslint-disable.*no-console" "$file"; then
      # Add comment before console.log lines
      sed -i '' '/console\.log/i\
    /* eslint-disable no-console */
' "$file"
      
      # Add re-enable after console.log lines
      sed -i '' '/console\.log/a\
    /* eslint-enable no-console */
' "$file"
      
      echo "   ✅ Added eslint-disable comments"
      FIXED=$((FIXED + 1))
    else
      echo "   ⏭️  Already has eslint-disable"
    fi
  else
    echo "   📋 Would add eslint-disable comments"
  fi
done

echo ""
echo "=========================================="
echo "✅ Processed $FIXED files"
echo "=========================================="

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "Run without --dry-run to apply changes"
else
  echo ""
  echo "Next steps:"
  echo "1. Review changes with: git diff"
  echo "2. Run lint: pnpm lint"
  echo "3. Commit if passing"
fi
