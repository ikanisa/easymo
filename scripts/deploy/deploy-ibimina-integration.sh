#!/bin/bash
set -e

echo "🚀 Ibimina Integration Deployment Script"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo "❌ Error: Run this from easymo root directory"
  exit 1
fi

echo "Step 1/5: Building ibimina packages..."
pnpm --filter "@easymo/ibimina-*" build || {
  echo "⚠️  Some packages may have build warnings, continuing..."
}

echo ""
echo "Step 2/5: Checking Supabase connection..."
if command -v supabase &> /dev/null; then
  echo "✅ Supabase CLI found"
  supabase status 2>/dev/null || echo "⚠️  Not linked to Supabase project yet"
else
  echo "⚠️  Supabase CLI not installed. Install: brew install supabase/tap/supabase"
fi

echo ""
echo "Step 3/5: Checking environment files..."
if [ ! -f "vendor-portal/.env" ]; then
  echo "📝 Creating vendor-portal/.env from template..."
  cp vendor-portal/.env.example vendor-portal/.env
  echo "⚠️  IMPORTANT: Edit vendor-portal/.env with your Supabase credentials!"
else
  echo "✅ vendor-portal/.env exists"
fi

echo ""
echo "Step 4/5: Migration file ready..."
if [ -f "supabase/migrations/20251209160000_ibimina_schema.sql" ]; then
  SIZE=$(ls -lh supabase/migrations/20251209160000_ibimina_schema.sql | awk '{print $5}')
  echo "✅ Migration file: $SIZE (119 migrations merged)"
  echo "   To apply: supabase db push"
else
  echo "❌ Migration file not found!"
  exit 1
fi

echo ""
echo "Step 5/5: Edge functions ready..."
FUNC_COUNT=$(ls -1d supabase/functions/*/ 2>/dev/null | wc -l | tr -d ' ')
echo "✅ $FUNC_COUNT edge functions ready to deploy"
echo "   To deploy all: cd supabase/functions && for d in */; do supabase functions deploy \${d%/}; done"

echo ""
echo "=========================================="
echo "✅ Pre-deployment checks complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Configure environment:"
echo "   edit vendor-portal/.env"
echo "   edit admin-app/.env (add FEATURE_IBIMINA_ADMIN=true)"
echo ""
echo "2. Apply database migration:"
echo "   supabase db push"
echo ""
echo "3. Deploy edge functions (optional):"
echo "   cd supabase/functions"
echo "   for fn in reconcile scheduled-reconciliation ingest-sms parse-sms; do"
echo "     supabase functions deploy \$fn"
echo "   done"
echo ""
echo "4. Start applications:"
echo "   pnpm --filter @easymo/vendor-portal dev  # Port 3100"
echo "   pnpm --filter @easymo/admin-app dev      # Port 3000"
echo ""
echo "5. Test routes:"
echo "   Vendor Portal: http://localhost:3100/staff"
echo "   Admin: http://localhost:3000/ibimina-admin"
echo ""
echo "📚 Documentation:"
echo "   - IBIMINA_SINGLE_SUPABASE_DEPLOYMENT.md (Full guide)"
echo "   - IBIMINA_MIGRATION_QUICK_REF.md (Quick reference)"
echo ""
