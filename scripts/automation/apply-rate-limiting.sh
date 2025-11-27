#!/bin/bash
set -euo pipefail

# Batch apply rate limiting to edge functions
# Usage: ./apply-rate-limiting.sh <function-name> <limit>

FUNC_NAME=$1
LIMIT=${2:-30}
WINDOW=60

FUNC_DIR="supabase/functions/$FUNC_NAME"
FUNC_FILE="$FUNC_DIR/index.ts"

if [ ! -f "$FUNC_FILE" ]; then
  echo "❌ Function not found: $FUNC_FILE"
  exit 1
fi

# Check if already has rate limiting
if grep -q "rateLimitMiddleware" "$FUNC_FILE"; then
  echo "⚠️  $FUNC_NAME already has rate limiting"
  exit 0
fi

echo "Processing $FUNC_NAME (${LIMIT} req/min)..."

# 1. Add import if missing
if ! grep -q "import.*rateLimitMiddleware" "$FUNC_FILE"; then
  # Find last import line
  LAST_IMPORT_LINE=$(grep -n "^import" "$FUNC_FILE" | tail -1 | cut -d: -f1)
  if [ -n "$LAST_IMPORT_LINE" ]; then
    # Add import after last import
    sed -i '' "${LAST_IMPORT_LINE}a\\
import { rateLimitMiddleware } from '../_shared/rate-limit/index.ts';
" "$FUNC_FILE"
    echo "  ✓ Added import"
  fi
fi

# 2. Find serve() location
SERVE_LINE=$(grep -n "serve(async" "$FUNC_FILE" | head -1 | cut -d: -f1)
if [ -z "$SERVE_LINE" ]; then
  echo "  ⚠️  Could not find serve() - manual intervention needed"
  exit 1
fi

# 3. Find CORS or first meaningful line after serve
CORS_LINE=$(tail -n +$SERVE_LINE "$FUNC_FILE" | grep -n "CORS\|OPTIONS\|method ===" | head -1 | cut -d: -f1)
if [ -z "$CORS_LINE" ]; then
  echo "  ⚠️  Could not find insertion point - manual intervention needed"
  exit 1
fi

INSERT_LINE=$((SERVE_LINE + CORS_LINE + 3))

# Create rate limit code
RATE_LIMIT_CODE="
  // Rate limiting (${LIMIT} req/min)
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: ${LIMIT},
    windowSeconds: ${WINDOW},
  });

  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response!;
  }
"

# Insert rate limit code
awk -v line="$INSERT_LINE" -v code="$RATE_LIMIT_CODE" '
  NR == line { print code }
  { print }
' "$FUNC_FILE" > "$FUNC_FILE.tmp" && mv "$FUNC_FILE.tmp" "$FUNC_FILE"

echo "✅ $FUNC_NAME protected with ${LIMIT} req/min rate limit"
