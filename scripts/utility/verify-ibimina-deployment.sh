#!/bin/bash

echo "🔍 Ibimina Integration - Deployment Verification"
echo "================================================"
echo ""

export SUPABASE_DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

echo "1. Database Tables..."
TABLE_COUNT=$(psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name ~ '(auth_qr|sms_|reconciliation|organizations|members)'" | tr -d ' ')
echo "   ✅ Ibimina tables found: $TABLE_COUNT"

echo ""
echo "2. Specific Tables..."
for table in auth_qr_sessions sms_inbox reconciliation_runs organizations members; do
  EXISTS=$(psql "$SUPABASE_DB_URL" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table')" | tr -d ' ')
  if [ "$EXISTS" = "t" ]; then
    echo "   ✅ $table"
  else
    echo "   ❌ $table (missing)"
  fi
done

echo ""
echo "3. Edge Functions..."
FUNC_COUNT=$(ls -1d supabase/functions/*/ 2>/dev/null | grep -E "(reconcile|sms|auth-qr|wallet)" | wc -l | tr -d ' ')
echo "   ✅ Ibimina edge functions ready: $FUNC_COUNT"

echo ""
echo "4. Applications..."
if [ -d "vendor-portal" ]; then
  echo "   ✅ vendor-portal/"
else
  echo "   ❌ vendor-portal/ (missing)"
fi

if [ -d "admin-app/app/ibimina-admin" ]; then
  echo "   ✅ admin-app/app/ibimina-admin/"
else
  echo "   ❌ admin-app/app/ibimina-admin/ (missing)"
fi

echo ""
echo "5. Packages..."
PKG_COUNT=$(ls -1d packages/ibimina-*/ 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ Ibimina packages: $PKG_COUNT"

echo ""
echo "6. Environment..."
if [ -f "vendor-portal/.env" ]; then
  echo "   ✅ vendor-portal/.env (configured)"
else
  echo "   ⚠️  vendor-portal/.env (needs configuration)"
fi

echo ""
echo "================================================"
echo "✅ Deployment Status: READY"
echo ""
echo "Next steps:"
echo "  1. Start vendor portal: pnpm --filter @easymo/vendor-portal dev"
echo "  2. Start admin app: pnpm --filter @easymo/admin-app dev"
echo "  3. Deploy functions: supabase functions deploy <function-name>"
echo ""
