#!/bin/bash
# Validation script for new migrations
# Run this before deploying to production

set -e

echo "🔍 Validating migration files..."
echo ""

# Check files exist
echo "✅ Checking migration files exist..."
test -f supabase/migrations/20251209220000_create_ai_agent_sessions.sql
test -f supabase/migrations/20251209220001_enhance_business_table_for_ai.sql
test -f supabase/migrations/20251209220002_create_ai_business_search.sql
echo "   All 3 migration files found"
echo ""

# Check BEGIN/COMMIT
echo "✅ Checking transaction wrappers..."
for file in supabase/migrations/202512092200*.sql; do
  if ! grep -q "^BEGIN;" "$file"; then
    echo "   ❌ Missing BEGIN in $file"
    exit 1
  fi
  if ! grep -q "^COMMIT;" "$file"; then
    echo "   ❌ Missing COMMIT in $file"
    exit 1
  fi
  echo "   $file has BEGIN/COMMIT ✓"
done
echo ""

# Check for idempotency
echo "✅ Checking idempotency (IF NOT EXISTS, IF EXISTS)..."
for file in supabase/migrations/202512092200*.sql; do
  # Should have IF NOT EXISTS or IF EXISTS
  if ! grep -qE "IF NOT EXISTS|IF EXISTS|DROP.*IF EXISTS" "$file"; then
    echo "   ⚠️  Warning: $file may not be idempotent"
  else
    echo "   $file appears idempotent ✓"
  fi
done
echo ""

# Check file sizes
echo "✅ Checking file sizes..."
ls -lh supabase/migrations/202512092200*.sql | awk '{print "   " $9 ": " $5}'
echo ""

# Syntax check (basic)
echo "✅ Basic SQL syntax check..."
for file in supabase/migrations/202512092200*.sql; do
  # Check for common syntax errors
  if grep -qE "CRATE TABLE|SLECT|FORM |WHER " "$file"; then
    echo "   ❌ Possible typo in $file"
    exit 1
  fi
  echo "   $file looks OK ✓"
done
echo ""

echo "✅ All validations passed!"
echo ""
echo "Next steps:"
echo "1. Review migration files manually"
echo "2. Test on local Supabase: supabase db reset"
echo "3. Deploy to production: supabase db push"
echo ""
