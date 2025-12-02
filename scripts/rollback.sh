#!/bin/bash
# Rollback to previous deployment
# Usage: ./rollback.sh <service-name> [commit-sha]

set -e

SERVICE=$1
COMMIT=${2:-HEAD~1}
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-lhbowpbcpwoiparwnwgt}"

if [ -z "$SERVICE" ]; then
    echo "Usage: $0 <service-name> [commit-sha]"
    exit 1
fi

echo "⏪ Rolling back ${SERVICE} to ${COMMIT}..."

# Create rollback branch
ROLLBACK_BRANCH="rollback-${SERVICE}-$(date +%Y%m%d%H%M%S)"
git checkout -b "$ROLLBACK_BRANCH" "$COMMIT" -- "supabase/functions/${SERVICE}/"

# Deploy rollback
echo "📦 Deploying rollback..."
supabase functions deploy "${SERVICE}" --no-verify-jwt --project-ref "${SUPABASE_PROJECT_REF}"

# Verify
echo "🔍 Verifying rollback..."
sleep 2

HEALTH_URL="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${SERVICE}/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Rollback successful!"
else
    echo "❌ Rollback verification failed (HTTP ${HTTP_CODE})"
    exit 1
fi

# Cleanup
git checkout -
echo "📝 Rollback branch created: ${ROLLBACK_BRANCH}"
echo "   To complete rollback, merge this branch or cherry-pick changes."
