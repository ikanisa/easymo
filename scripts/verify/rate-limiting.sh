#!/bin/bash
set -euo pipefail

echo "Verifying rate limiting on all public endpoints..."

SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "ERROR: SUPABASE_ANON_KEY not set"
  exit 1
fi

ENDPOINTS=(
  "wa-webhook-core"
  "wa-webhook-mobility"
  "momo-webhook"
  "business-lookup"
  "bars-lookup"
)

for endpoint in "${ENDPOINTS[@]}"; do
  echo ""
  echo "Testing rate limiting for $endpoint..."
  
  # Send requests rapidly
  success_count=0
  rate_limited=false
  
  for i in {1..150}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" \
      "$SUPABASE_URL/functions/v1/$endpoint" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d '{"test": true}' 2>/dev/null || echo "000")
    
    if [ "$response" == "429" ]; then
      echo "✅ Rate limit triggered at request $i for $endpoint"
      rate_limited=true
      break
    elif [ "$response" == "200" ] || [ "$response" == "201" ]; then
      ((success_count++))
    fi
  done
  
  if [ "$rate_limited" = false ]; then
    echo "⚠️  WARNING: $endpoint did not trigger rate limiting after 150 requests"
  fi
done

echo ""
echo "Rate limit verification complete!"
