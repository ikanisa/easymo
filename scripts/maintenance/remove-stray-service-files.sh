#!/bin/bash
set -euo pipefail

echo "🔄 Archiving stray files from services/ directory..."

# Files to archive
STRAY_FILES=(
  "services/gemini.ts"
)

# Create archive directory
mkdir -p .archive/services-stray

# Archive files
for file in "${STRAY_FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" ".archive/services-stray/$(basename $file).$(date +%Y%m%d)"
    echo "✅ Archived: $file → .archive/services-stray/"
  else
    echo "⏭️  Already removed: $file"
  fi
done

# Check if gemini.ts is already properly used from ai/ or packages/
echo ""
echo "📋 Checking usage of gemini.ts..."
IMPORTS=$(grep -r "from.*services/gemini" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v .archive || true)

if [ -n "$IMPORTS" ]; then
  echo "⚠️  Found imports that need updating:"
  echo "$IMPORTS"
  echo ""
  echo "These imports should reference the proper package location."
else
  echo "✅ No problematic imports found"
  
  # Safe to remove after archiving
  for file in "${STRAY_FILES[@]}"; do
    if [ -f "$file" ]; then
      rm "$file"
      echo "🗑️  Removed: $file"
    fi
  done
fi

echo "✅ Stray files cleanup complete"
