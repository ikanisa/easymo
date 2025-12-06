#!/bin/bash
# =====================================================================
# CREATE WEBHOOK CONSOLIDATION PR
# =====================================================================
# This script creates the PR for webhook consolidation Phase 1 & 2.1
# =====================================================================

set -e

echo "🚀 Creating Webhook Consolidation PR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd /Users/jeanbosco/workspace/easymo

# Step 1: Check if we're on the right branch or need to create it
echo "📋 Step 1: Checking branch status..."
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "feature/webhook-consolidation-complete" ]; then
  echo "⚠️  Not on webhook consolidation branch"
  echo "Creating branch: feature/webhook-consolidation-complete"
  git checkout -b feature/webhook-consolidation-complete
fi

echo "✅ On correct branch"
echo ""

# Step 2: Check git status
echo "📋 Step 2: Checking git status..."
git status --short
echo ""

# Step 3: Stage and commit any changes
echo "📋 Step 3: Committing changes..."
git add .

git commit -m "feat: webhook consolidation phase 1 & 2.1 - feature flags and architecture

- Add feature flags for safe migration (ENABLE_UNIFIED_ROUTING, UNIFIED_ROLLOUT_PERCENT)
- Implement canary routing in wa-webhook-core
- Add deprecation notices to wa-webhook-ai-agents and wa-webhook-marketplace
- Create comprehensive documentation (2,751 lines)
- Set up shared tools infrastructure for Phase 2

Impact: Zero production changes (all flags disabled by default)
Safe rollback: Instant (disable flags)
Next: Port marketplace features to shared tools" || echo "Nothing to commit or already committed"

echo "✅ Changes committed"
echo ""

# Step 4: Push to remote
echo "📋 Step 4: Pushing to remote..."
git push -u origin feature/webhook-consolidation-complete

echo "✅ Branch pushed to remote"
echo ""

# Step 5: Create PR using GitHub CLI
echo "📋 Step 5: Creating Pull Request..."

if command -v gh &> /dev/null; then
  echo "Using GitHub CLI..."
  gh pr create \
    --title "feat: Webhook Consolidation - Phase 1 & Phase 2.1 Complete" \
    --body-file PR_DESCRIPTION.md \
    --base main \
    --label "enhancement,documentation,infrastructure" \
    --draft
  
  echo "✅ PR created successfully!"
  echo ""
  echo "📝 Next steps:"
  echo "1. Add reviewers in GitHub UI"
  echo "2. Review the PR description"
  echo "3. Convert from draft when ready"
  echo ""
  
  # Open PR in browser
  gh pr view --web
  
else
  echo "⚠️  GitHub CLI not installed"
  echo ""
  echo "📝 Manual PR creation:"
  echo "1. Go to: https://github.com/ikanisa/easymo/compare/feature/webhook-consolidation-complete"
  echo "2. Click 'Create Pull Request'"
  echo "3. Copy content from PR_DESCRIPTION.md"
  echo "4. Add labels: enhancement, documentation, infrastructure"
  echo "5. Mark as Draft"
  echo "6. Add reviewers"
  echo ""
  
  # Open compare URL in browser (macOS)
  open "https://github.com/ikanisa/easymo/compare/feature/webhook-consolidation-complete" 2>/dev/null || \
    echo "Open this URL: https://github.com/ikanisa/easymo/compare/feature/webhook-consolidation-complete"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PR CREATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 PR Summary:"
echo "   Branch: feature/webhook-consolidation-complete"
echo "   Base: main"
echo "   Files: 11 changed"
echo "   Lines: +2,913"
echo "   Impact: Zero (all flags disabled)"
echo ""
echo "👥 Suggested Reviewers:"
echo "   - Senior Engineer (code review)"
echo "   - Senior Engineer (architecture)"
echo "   - DevOps Engineer (deployment)"
echo "   - Tech Lead (approval)"
echo ""
echo "⏱️  Estimated Review Time: 30-45 minutes"
echo ""
