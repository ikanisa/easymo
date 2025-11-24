#!/bin/bash
# Validation script for wa-webhook enhancements
# Run this to verify all enhancements are properly installed

set -e

echo "🔍 Validating wa-webhook Enhancements..."
echo ""

# Check files exist
echo "📁 Checking files..."
files=(
  "rate_limiter.ts"
  "cache.ts"
  "error_handler.ts"
  "metrics_collector.ts"
  "health_check.ts"
  "config_validator.ts"
  "middleware.ts"
  "ENHANCEMENTS.md"
  "INTEGRATION_GUIDE.md"
  "README.md"
  "QUICKREF.md"
  "rate_limiter.test.ts"
  "cache.test.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file MISSING!"
    exit 1
  fi
done

echo ""
echo "📊 File Statistics:"
echo "  Total utilities: 7"
echo "  Total tests: 2"
echo "  Total docs: 4"
echo "  Total lines: $(wc -l *.ts | tail -1 | awk '{print $1}')"

echo ""
echo "🔧 Environment Variables Check:"
env_vars=(
  "WA_ENABLE_RATE_LIMITING"
  "WA_ENABLE_CACHING"
  "WA_ENABLE_USER_ERROR_NOTIFICATIONS"
)

for var in "${env_vars[@]}"; do
  value="${!var:-not set}"
  echo "  $var: $value"
done

echo ""
echo "✅ All enhancements validated successfully!"
echo ""
echo "📖 Next steps:"
echo "  1. Review INTEGRATION_GUIDE.md for deployment"
echo "  2. Check QUICKREF.md for quick commands"
echo "  3. Enable features gradually via env vars"
echo ""
