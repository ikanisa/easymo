#!/usr/bin/env bash
set -euo pipefail

# Configure branch protection for `main` using the GitHub REST API via `gh`.
# Requires: gh CLI authenticated with admin repo scope.

OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
OWNER=${OWNER_REPO%/*}
REPO=${OWNER_REPO#*/}

echo "Configuring branch protection for $OWNER/$REPO: main"

required_checks=(
  "Validate + Build Packages"
  "Build Backend Apps"
  "Build + Test Admin App"
  "Monorepo Build (reduced concurrency)"
  "Typecheck Packages & Apps"
  "Lint Monorepo"
)

contexts_json=$(printf '%s
' "${required_checks[@]}" | jq -R . | jq -s .)

gh api \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$OWNER/$REPO/branches/main/protection" \
  -f required_status_checks.strict=true \
  -f enforce_admins=true \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f restrictions=null \
  --raw-field required_status_checks.contexts="$(echo "$contexts_json")"

echo "Branch protection updated."

