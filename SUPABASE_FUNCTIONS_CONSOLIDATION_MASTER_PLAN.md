# Supabase Functions Consolidation Master Plan
**Created:** 2025-12-03  
**Status:** Week 4-8 Implementation Ready

---

## Executive Summary

**Current State:** 73 active Supabase Edge Functions  
**Target State:** 58 functions after Phase 1 (21% reduction)  
**Protected (Production):** wa-webhook-mobility, wa-webhook-profile, wa-webhook-insurance

### Key Metrics
- **Already Archived:** 15+ agent duplicates, 4 inactive batches
- **Safe to Delete:** 19 functions (verified no code references, 1+ month inactive)
- **Consolidate:** 4 webhook functions → wa-webhook-unified

---

## Phase 1: Safe Deletions (Week 4)

### ✅ Already Archived (Do Not Re-delete)
These are safely moved to `.archive/`:
- agent-chat, agent-config-invalidator, agent-monitor, agent-negotiation
- agent-property-rental, agent-quincaillerie, agent-runner, agent-schedule-trip
- agent-shops, agent-tools-general-broker, agents, job-board-ai-agent, waiter-ai-agent
- video-performance-summary (archived in inactive-batch2-20251203)

### 🗑️ Functions to DELETE (19 total)

#### Batch 1: Admin Legacy (5 functions)
**Reason:** Replaced by admin-app Next.js routes, no invocations in codebase
```bash
# ❌ DELETE - Last activity 1+ month ago
supabase functions delete admin-subscriptions --project-ref <ref>
supabase functions delete admin-wallet-api      --project-ref <ref>
supabase functions delete insurance-admin-api   --project-ref <ref>
supabase functions delete campaign-dispatcher   --project-ref <ref>
supabase functions delete housekeeping          --project-ref <ref>
```

**Evidence:**
- admin-subscriptions: No references in code, subscription logic now in admin-app
- admin-wallet-api: Replaced by services/wallet-service
- insurance-admin-api: Minimal activity (1 commit in 3 months)
- campaign-dispatcher: 4 commits in 3 months, campaign logic moved to notification-worker
- housekeeping: Data retention handled by data-retention function

---

#### Batch 2: Reminder/Cart Services (3 functions)
**Reason:** E-commerce features not in production, no active usage
```bash
# ❌ DELETE - E-commerce cart features (not live)
supabase functions delete cart-reminder           --project-ref <ref>
supabase functions delete order-pending-reminder  --project-ref <ref>
supabase functions delete reminder-service        --project-ref <ref>
```

**Evidence:**
- No shopping cart tables in migrations
- reminder-service: 1 commit in 3 months
- order-pending-reminder: No references in client code

---

#### Batch 3: Mock/Test Services (3 functions)
**Reason:** Development/testing only, not for production
```bash
# ❌ DELETE - Mock/simulator services
supabase functions delete flow-exchange-mock --project-ref <ref>
supabase functions delete flow-exchange      --project-ref <ref>
supabase functions delete simulator          --project-ref <ref>
```

**Evidence:**
- flow-exchange-mock: Testing tool for flow debugging
- simulator: WhatsApp message simulator, used in development only

---

#### Batch 4: Diagnostic/Legacy (4 functions)
**Reason:** Diagnostic tools, replaced by observability stack
```bash
# ❌ DELETE - Diagnostic/deprecated
supabase functions delete wa-webhook-diag        --project-ref <ref>
supabase functions delete agent-doc-embed        --project-ref <ref>
supabase functions delete agent-doc-search       --project-ref <ref>
supabase functions delete insurance-media-fetch  --project-ref <ref>
```

**Evidence:**
- wa-webhook-diag: Debugging tool, replaced by structured logging
- agent-doc-embed/search: 1 month inactive, RAG moved to OpenAI assistant
- insurance-media-fetch: 1 month inactive, OCR uses insurance-ocr

---

#### Batch 5: Analytics/Cleanup (4 functions)
**Reason:** Low usage, functionality consolidated elsewhere
```bash
# ❌ DELETE - Minimal usage analytics
supabase functions delete video-performance-summary  --project-ref <ref>  # (if not already archived)
supabase functions delete session-cleanup            --project-ref <ref>
supabase functions delete search-alert-notifier      --project-ref <ref>
supabase functions delete search-indexer             --project-ref <ref>
```

**Evidence:**
- video-performance-summary: 13 days ago activity but no usage patterns
- session-cleanup: 1 commit in 3 months, cleanup handled by data-retention
- search-alert/indexer: 1 commit each, search moved to retrieval-search

---

## Phase 2: Webhook Consolidation (Weeks 5-6)

### 🔄 Merge into wa-webhook-unified

#### Target: 4 webhooks → 1 unified handler

**⚠️ PROTECTED (Production - Additive Only):**
- ✅ **wa-webhook-mobility** (313 commits, PRODUCTION)
- ✅ **wa-webhook-profile** (42 commits, PRODUCTION)
- ✅ **wa-webhook-insurance** (45 commits, PRODUCTION)

**📦 TO CONSOLIDATE:**
- wa-webhook-ai-agents → wa-webhook-unified
- wa-webhook-jobs → wa-webhook-unified
- wa-webhook-marketplace → wa-webhook-unified
- wa-webhook-property → wa-webhook-unified

### Consolidation Strategy

#### Week 5: Integration (Non-destructive)
```typescript
// wa-webhook-unified/core/orchestrator.ts enhancement
import { PropertyAgent } from '../domains/property/agent.ts';
import { JobsAgent } from '../domains/jobs/agent.ts';
import { MarketplaceAgent } from '../domains/marketplace/agent.ts';
import { AIAgentsOrchestrator } from '../domains/ai-agents/orchestrator.ts';

// Add routing logic
if (intent.domain === 'property') {
  return await PropertyAgent.handle(message, supabase);
}
if (intent.domain === 'jobs') {
  return await JobsAgent.handle(message, supabase);
}
// etc...
```

**Implementation Steps:**
1. Copy domain logic from 4 functions into wa-webhook-unified/domains/
2. Update orchestrator routing table
3. Deploy wa-webhook-unified with new routes
4. Test with 10% traffic split (feature flag)

#### Week 6: Traffic Migration
```bash
# Phase A: 10% traffic (Week 5 end)
# Update webhook URL in WhatsApp Business config to route 10% to unified

# Phase B: 50% traffic (Week 6 Day 1-3)
# Monitor error rates, latency, DLQ metrics

# Phase C: 100% traffic (Week 6 Day 4-7)
# Full migration, keep old functions as backup

# Phase D: Deprecation (Week 7)
# Delete old functions after 1 week observation
supabase functions delete wa-webhook-ai-agents   --project-ref <ref>
supabase functions delete wa-webhook-jobs        --project-ref <ref>
supabase functions delete wa-webhook-marketplace --project-ref <ref>
supabase functions delete wa-webhook-property    --project-ref <ref>
```

---

## Phase 3: Core Function Optimization (Weeks 7-8)

### Deduplication Analysis

#### wa-webhook vs wa-webhook-core
**Finding:** wa-webhook (313 commits) is now a **shared library**, not an endpoint  
**Action:** Rename for clarity
```bash
# Week 7
mv supabase/functions/wa-webhook supabase/functions/_shared/wa-webhook-lib
# Update all imports in:
# - wa-webhook-mobility, wa-webhook-profile, wa-webhook-insurance
# - wa-webhook-core
```

#### Cleanup Functions
**Consolidate:** cleanup-expired-intents + cleanup-mobility-intents → data-retention
```bash
# Week 8
# Merge cleanup logic into data-retention (1 cron vs 3)
supabase functions delete cleanup-expired-intents  --project-ref <ref>
supabase functions delete cleanup-mobility-intents --project-ref <ref>
```

---

## Implementation Timeline

### Week 4: Safe Deletions (Dec 3-10, 2025)

**Day 1-2: Verification**
- [x] Archive analysis complete
- [ ] Run code reference scan for all 19 delete candidates
- [ ] Check Supabase dashboard for invocation metrics (last 30 days)
- [ ] Verify no cron jobs reference these functions

**Day 3-4: Batch Deletions**
```bash
# Execute deletions in batches (1 batch per day)
# Day 3: Admin Legacy + Reminder Services (8 functions)
# Day 4: Mock/Diagnostic + Analytics (11 functions)
```

**Day 5: Monitoring**
- Monitor error logs for missing function errors
- Check DLQ for failed webhook deliveries
- Validate admin-app still functional

**Deliverable:** 19 functions deleted, 54 active functions remaining

---

### Week 5: Unified Webhook Integration (Dec 10-17, 2025)

**Day 1-2: Code Migration**
```bash
# Copy domain logic preserving structure
cd supabase/functions/wa-webhook-unified

# Property domain
cp -r ../wa-webhook-property/property ./domains/
cp ../wa-webhook-property/handlers/* ./domains/property/

# Jobs domain  
cp -r ../wa-webhook-jobs/jobs ./domains/
cp ../wa-webhook-jobs/utils/* ./domains/jobs/

# Marketplace domain
cp -r ../wa-webhook-marketplace/agent.ts ./domains/marketplace/
cp ../wa-webhook-marketplace/utils/* ./domains/marketplace/

# AI Agents domain
cp -r ../wa-webhook-ai-agents/agents ./domains/ai-agents/
cp ../wa-webhook-ai-agents/orchestrator.ts ./domains/ai-agents/
```

**Day 3-4: Integration Testing**
```bash
# Run test suite
cd supabase/functions/wa-webhook-unified
deno task test

# Manual testing with real WhatsApp messages
# Test property search, job applications, marketplace listings
```

**Day 5: Deploy + 10% Traffic**
```bash
# Deploy unified function
supabase functions deploy wa-webhook-unified --project-ref <ref>

# Update environment variable for traffic split
# FEATURE_UNIFIED_WEBHOOK_PERCENT=10
```

**Deliverable:** wa-webhook-unified handling 4 new domains, 10% production traffic

---

### Week 6: Traffic Migration (Dec 17-24, 2025)

**Day 1: 50% Traffic**
```bash
# Update feature flag
# FEATURE_UNIFIED_WEBHOOK_PERCENT=50

# Monitor metrics:
# - Response time (target: <500ms p95)
# - Error rate (target: <0.1%)
# - DLQ entries (target: <10/hour)
```

**Day 2-3: Observation**
- Compare metrics: unified vs individual webhooks
- Check Supabase logs for any routing errors
- Validate WhatsApp Business API deliverability

**Day 4: 100% Traffic**
```bash
# Full migration
# FEATURE_UNIFIED_WEBHOOK_PERCENT=100

# Keep old functions as backup (no deletion yet)
```

**Day 5-7: Stability Period**
- 3-day observation window
- No deployments to webhook functions
- Collect performance baseline for unified handler

**Deliverable:** 100% traffic on wa-webhook-unified, 4 old webhooks on standby

---

### Week 7: Deprecation + Library Refactor (Dec 24-31, 2025)

**Day 1-2: Delete Consolidated Webhooks**
```bash
# After 1 week of successful unified operation
supabase functions delete wa-webhook-ai-agents   --project-ref <ref>
supabase functions delete wa-webhook-jobs        --project-ref <ref>
supabase functions delete wa-webhook-marketplace --project-ref <ref>
supabase functions delete wa-webhook-property    --project-ref <ref>
```

**Day 3-5: wa-webhook Library Rename**
```bash
# Clarify that wa-webhook is shared code, not an endpoint
git mv supabase/functions/wa-webhook supabase/functions/_shared/wa-webhook-lib

# Update imports in:
# - wa-webhook-mobility/index.ts
# - wa-webhook-profile/index.ts  
# - wa-webhook-insurance/index.ts
# - wa-webhook-core/router.ts
# - wa-webhook-unified/core/orchestrator.ts

# Find and replace:
find supabase/functions -name "*.ts" -exec sed -i '' 's|from "../wa-webhook/|from "../_shared/wa-webhook-lib/|g' {} +
```

**Day 6-7: Testing + Deployment**
```bash
# Test protected production webhooks
deno task test:mobility
deno task test:profile
deno task test:insurance

# Deploy updates
supabase functions deploy wa-webhook-mobility --project-ref <ref>
supabase functions deploy wa-webhook-profile --project-ref <ref>
supabase functions deploy wa-webhook-insurance --project-ref <ref>
supabase functions deploy wa-webhook-core --project-ref <ref>
supabase functions deploy wa-webhook-unified --project-ref <ref>
```

**Deliverable:** 50 active functions, clear separation of libraries vs endpoints

---

### Week 8: Cleanup Consolidation (Dec 31 - Jan 7, 2026)

**Day 1-3: Merge Cleanup Functions**
```typescript
// Enhance supabase/functions/data-retention/index.ts
// Add logic from cleanup-expired-intents and cleanup-mobility-intents

async function cleanupExpiredIntents(supabase: SupabaseClient) {
  // Existing logic from cleanup-expired-intents
  const expiryThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h
  await supabase.from('user_intents')
    .delete()
    .lt('created_at', expiryThreshold.toISOString());
}

async function cleanupMobilityIntents(supabase: SupabaseClient) {
  // Existing logic from cleanup-mobility-intents  
  await supabase.from('mobility_intents')
    .delete()
    .eq('status', 'expired');
}

// Update main handler
Deno.serve(async (req) => {
  // ... existing data retention logic ...
  await cleanupExpiredIntents(supabase);
  await cleanupMobilityIntents(supabase);
});
```

**Day 4: Update Cron Jobs**
```toml
# supabase/config.toml
# Remove old cron entries, keep only data-retention
[functions.cleanup-expired-intents]  # DELETE this section
[functions.cleanup-mobility-intents] # DELETE this section

# Ensure data-retention runs comprehensive cleanup
[functions.data-retention]
verify_jwt = false
cron = "0 2 * * *"  # Daily at 2 AM
```

**Day 5: Deploy + Delete**
```bash
# Deploy enhanced data-retention
supabase functions deploy data-retention --project-ref <ref>

# Verify cron execution
# Wait 24 hours for first run

# Delete old cleanup functions
supabase functions delete cleanup-expired-intents  --project-ref <ref>
supabase functions delete cleanup-mobility-intents --project-ref <ref>
```

**Day 6-7: Final Verification**
- Confirm data-retention cron runs successfully
- Check database for orphaned intents (should be cleaned up)
- Validate no errors in Supabase logs

**Deliverable:** 48 active functions, consolidated cleanup into 1 scheduled job

---

## Final State Summary

### Before Consolidation
- **Total Functions:** 73 active + 15 archived = 88
- **Webhook Handlers:** 9 separate microservices
- **Cleanup Jobs:** 3 cron functions
- **Legacy/Unused:** 19 inactive functions

### After Phase 1-3 (Week 8 Complete)
- **Total Functions:** 48 active (34% reduction from 73)
- **Webhook Handlers:** 5 (mobility, profile, insurance, core, unified)
- **Cleanup Jobs:** 1 (data-retention)
- **Deleted:** 25 functions total

### Breakdown by Category

| Category | Before | After | Change |
|----------|--------|-------|--------|
| **Webhooks** | 9 | 5 | -4 (consolidated) |
| **Admin** | 8 | 5 | -3 (deleted legacy) |
| **AI/Agents** | 15 | 0 | -15 (archived) |
| **Cleanup/Cron** | 3 | 1 | -2 (merged) |
| **OCR/Media** | 5 | 3 | -2 (deleted duplicates) |
| **Payments** | 7 | 7 | No change (all active) |
| **Jobs/Scraping** | 4 | 4 | No change |
| **Tools/Utilities** | 12 | 10 | -2 (deleted mock/diag) |
| **Search/Lookup** | 8 | 6 | -2 (consolidated) |
| **Other** | 13 | 7 | -6 (deleted analytics/legacy) |

---

## Risk Mitigation

### Protected Functions (NEVER DELETE)
✅ **wa-webhook-mobility** - 313 commits, production traffic  
✅ **wa-webhook-profile** - 42 commits, production traffic  
✅ **wa-webhook-insurance** - 45 commits, production traffic

### Rollback Strategy
```bash
# If unified webhook fails, revert traffic immediately
# FEATURE_UNIFIED_WEBHOOK_PERCENT=0

# Restore individual webhooks from git history
git checkout HEAD~1 -- supabase/functions/wa-webhook-property
git checkout HEAD~1 -- supabase/functions/wa-webhook-jobs
git checkout HEAD~1 -- supabase/functions/wa-webhook-marketplace
git checkout HEAD~1 -- supabase/functions/wa-webhook-ai-agents

# Redeploy
supabase functions deploy wa-webhook-property --project-ref <ref>
# ... etc
```

### Monitoring Checklist
- [ ] Error rate < 0.1% for unified webhook
- [ ] P95 latency < 500ms  
- [ ] DLQ entries < 10/hour
- [ ] No increase in failed WhatsApp deliveries
- [ ] Admin dashboard remains functional after admin function deletions

---

## Success Criteria

### Week 4 ✅
- [ ] 19 functions deleted safely
- [ ] No errors in Supabase logs
- [ ] Admin app functional
- [ ] Zero production impact

### Week 5 ✅
- [ ] wa-webhook-unified deployed with 4 new domains
- [ ] 10% traffic successfully routed
- [ ] Test coverage >80% for new domains
- [ ] Performance within SLA

### Week 6 ✅
- [ ] 100% traffic on wa-webhook-unified
- [ ] Error rate maintained  
- [ ] Latency within targets
- [ ] Old webhooks ready for deletion

### Week 7 ✅
- [ ] 4 consolidated webhooks deleted
- [ ] wa-webhook renamed to _shared/wa-webhook-lib
- [ ] All imports updated
- [ ] Production webhooks (mobility, profile, insurance) still functional

### Week 8 ✅
- [ ] Cleanup functions consolidated into data-retention
- [ ] Cron jobs optimized (3 → 1)
- [ ] Final count: 48 active functions
- [ ] Documentation updated

---

## Deliverables

### Week 4
- **DELETED_FUNCTIONS_REPORT.md** - List of 19 deleted functions with rationale
- **CODE_SCAN_RESULTS.txt** - Grep output showing no references

### Week 5
- **UNIFIED_WEBHOOK_INTEGRATION.md** - Technical implementation details
- **TEST_COVERAGE_REPORT.md** - Test results for new domains

### Week 6
- **TRAFFIC_MIGRATION_METRICS.md** - Performance comparison (10% / 50% / 100%)
- **ERROR_LOG_ANALYSIS.md** - Summary of any issues encountered

### Week 7
- **DEPRECATION_SUMMARY.md** - Final list of deleted webhook functions
- **LIBRARY_REFACTOR_CHECKLIST.md** - Import updates verification

### Week 8
- **FINAL_CONSOLIDATION_REPORT.md** - Before/after comparison, metrics, lessons learned
- **FUNCTIONS_INVENTORY.md** - Complete list of 48 remaining functions with purpose

---

## Commands Reference

### Delete Functions (Week 4)
```bash
# Set project ref
export SUPABASE_PROJECT_REF="your-project-ref"

# Batch 1: Admin Legacy
supabase functions delete admin-subscriptions --project-ref $SUPABASE_PROJECT_REF
supabase functions delete admin-wallet-api --project-ref $SUPABASE_PROJECT_REF
supabase functions delete insurance-admin-api --project-ref $SUPABASE_PROJECT_REF
supabase functions delete campaign-dispatcher --project-ref $SUPABASE_PROJECT_REF
supabase functions delete housekeeping --project-ref $SUPABASE_PROJECT_REF

# Batch 2: Reminder Services
supabase functions delete cart-reminder --project-ref $SUPABASE_PROJECT_REF
supabase functions delete order-pending-reminder --project-ref $SUPABASE_PROJECT_REF
supabase functions delete reminder-service --project-ref $SUPABASE_PROJECT_REF

# Batch 3: Mock/Test
supabase functions delete flow-exchange-mock --project-ref $SUPABASE_PROJECT_REF
supabase functions delete flow-exchange --project-ref $SUPABASE_PROJECT_REF
supabase functions delete simulator --project-ref $SUPABASE_PROJECT_REF

# Batch 4: Diagnostic
supabase functions delete wa-webhook-diag --project-ref $SUPABASE_PROJECT_REF
supabase functions delete agent-doc-embed --project-ref $SUPABASE_PROJECT_REF
supabase functions delete agent-doc-search --project-ref $SUPABASE_PROJECT_REF
supabase functions delete insurance-media-fetch --project-ref $SUPABASE_PROJECT_REF

# Batch 5: Analytics
supabase functions delete session-cleanup --project-ref $SUPABASE_PROJECT_REF
supabase functions delete search-alert-notifier --project-ref $SUPABASE_PROJECT_REF
supabase functions delete search-indexer --project-ref $SUPABASE_PROJECT_REF
```

### Deploy Unified Webhook (Week 5-6)
```bash
supabase functions deploy wa-webhook-unified --project-ref $SUPABASE_PROJECT_REF --no-verify-jwt
```

### Delete Consolidated Webhooks (Week 7)
```bash
supabase functions delete wa-webhook-ai-agents --project-ref $SUPABASE_PROJECT_REF
supabase functions delete wa-webhook-jobs --project-ref $SUPABASE_PROJECT_REF
supabase functions delete wa-webhook-marketplace --project-ref $SUPABASE_PROJECT_REF
supabase functions delete wa-webhook-property --project-ref $SUPABASE_PROJECT_REF
```

### Delete Cleanup Functions (Week 8)
```bash
supabase functions delete cleanup-expired-intents --project-ref $SUPABASE_PROJECT_REF
supabase functions delete cleanup-mobility-intents --project-ref $SUPABASE_PROJECT_REF
```

---

## Next Steps

**Immediate Action (Week 4 Day 1):**
```bash
# 1. Run comprehensive code scan
grep -r "admin-subscriptions\|admin-wallet-api\|insurance-admin-api" src/ admin-app/ services/ --include="*.ts" --include="*.tsx"

# 2. Check Supabase dashboard invocation metrics
# Login to Supabase → Functions → Check "Invocations" for last 30 days

# 3. Start with safest batch (Mock/Test services)
supabase functions delete simulator --project-ref $SUPABASE_PROJECT_REF
```

**Authorization Required:**
- [ ] Approval to delete 19 functions (Week 4)
- [ ] Approval to modify wa-webhook-unified (Week 5)
- [ ] Approval for 100% traffic migration (Week 6)
- [ ] Approval to delete consolidated webhooks (Week 7)

---

**Plan Author:** GitHub Copilot CLI  
**Review Status:** Pending stakeholder approval  
**Implementation Owner:** Platform Team
