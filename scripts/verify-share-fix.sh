#!/bin/bash

# Quick verification that Share easyMO fix is properly implemented

echo "🔍 Verifying Share easyMO Fix Implementation..."
echo ""

# Check migration file exists
if [ -f "supabase/migrations/20251210064023_create_referral_links.sql" ]; then
  echo "✅ Migration file exists"
else
  echo "❌ Migration file missing"
  exit 1
fi

# Check duplicate share.ts files are removed
if [ ! -f "supabase/functions/wa-webhook/utils/share.ts" ]; then
  echo "✅ Duplicate wa-webhook/utils/share.ts removed"
else
  echo "❌ Duplicate wa-webhook/utils/share.ts still exists"
  exit 1
fi

if [ ! -f "supabase/functions/wa-webhook-mobility/utils/share.ts" ]; then
  echo "✅ Duplicate wa-webhook-mobility/utils/share.ts removed"
else
  echo "❌ Duplicate wa-webhook-mobility/utils/share.ts still exists"
  exit 1
fi

# Check canonical shared file exists
if [ -f "supabase/functions/_shared/wa-webhook-shared/utils/share.ts" ]; then
  echo "✅ Canonical shared/utils/share.ts exists"
else
  echo "❌ Canonical shared/utils/share.ts missing"
  exit 1
fi

# Check imports updated
echo ""
echo "📝 Checking imports..."

FILES_TO_CHECK=(
  "supabase/functions/wa-webhook/router/interactive_button.ts"
  "supabase/functions/wa-webhook/domains/wallet/earn.ts"
  "supabase/functions/wa-webhook/domains/business/deeplink.ts"
  "supabase/functions/wa-webhook/flows/momo/qr.ts"
  "supabase/functions/wa-webhook-mobility/flows/momo/qr.ts"
)

for file in "${FILES_TO_CHECK[@]}"; do
  if grep -q "_shared/wa-webhook-shared/utils/share" "$file"; then
    echo "  ✅ $file uses shared version"
  else
    echo "  ❌ $file not using shared version"
    exit 1
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All verification checks passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Commit changes: git add . && git commit -m 'fix: Share easyMO button - create referral_links table'"
echo "3. Deploy: ./scripts/deploy/deploy-share-easymo-fix.sh"
echo ""
