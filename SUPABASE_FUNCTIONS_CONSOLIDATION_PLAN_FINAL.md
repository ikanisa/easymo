# Supabase Functions Consolidation Plan - Complete Implementation Guide

**Date**: December 3, 2025  
**Current Count**: 78 functions  
**Target Count**: 64 functions (18% reduction)  
**Timeline**: Weeks 4-8 (5 weeks)

---

## 📊 Executive Summary

### Current State Analysis
- **Total Functions**: 78 (live in supabase/functions/)
- **Already Archived**: 13 agent duplicates in `.archive/agent-duplicates-20251203/`
- **Production Critical**: 3 webhooks (mobility, profile, insurance)
- **Deployment Status**: 11 wa-webhook functions deployed and active

### Consolidation Strategy
1. **Agent Functions**: Already moved to archive (COMPLETE ✅)
2. **WA-Webhook Consolidation**: Merge 4 functions into wa-webhook-unified
3. **Inactive Functions**: Delete 10 dormant/legacy functions
4. **Traffic Migration**: Progressive 10% → 50% → 100% over 4 weeks

---

## 🎯 Phase 1: ALREADY COMPLETED ✅

### Agent Duplicates (Archived on Dec 3, 2025)
**Status**: Functions moved to `.archive/agent-duplicates-20251203/`

**Archived Functions** (13 total):
```
✅ agent-chat
✅ agent-config-invalidator
✅ agent-monitor
✅ agent-negotiation
✅ agent-property-rental
✅ agent-quincaillerie
✅ agent-runner
✅ agent-schedule-trip
✅ agent-shops
✅ agent-tools-general-broker
✅ agents
✅ job-board-ai-agent
✅ waiter-ai-agent
```

**Next Action**: Delete from Supabase remote
```bash
supabase functions delete agent-chat
supabase functions delete agent-config-invalidator
supabase functions delete agent-monitor
supabase functions delete agent-negotiation
supabase functions delete agent-property-rental
supabase functions delete agent-quincaillerie
supabase functions delete agent-runner
supabase functions delete agent-schedule-trip
supabase functions delete agent-shops
supabase functions delete agent-tools-general-broker
supabase functions delete agents
supabase functions delete job-board-ai-agent
supabase functions delete waiter-ai-agent
```

---

## 🚨 PRODUCTION-CRITICAL FUNCTIONS (DO NOT MODIFY)

### ✅ Protected Webhooks (Additive Changes Only)
These are LIVE in production with real traffic:

1. **wa-webhook-mobility** (585 lines, 23KB)
   - Version: 492 (latest deploy: Dec 3, 2025)
   - Status: ACTIVE, high traffic
   - Protection: Additive changes only, no routing changes

2. **wa-webhook-profile** (1,142 lines, 47KB) 
   - Version: 294 (latest deploy: Dec 2, 2025)
   - Status: ACTIVE, high traffic
   - Protection: Additive changes only, no routing changes

3. **wa-webhook-insurance** (398 lines, 13KB)
   - Version: 342 (latest deploy: Dec 2, 2025)
   - Status: ACTIVE, high traffic
   - Protection: Additive changes only, no routing changes

### ✅ Core Infrastructure (Keep)
- **wa-webhook-core** (248 lines) - Base webhook handler
- **wa-webhook** (120 lines) - Legacy router (still active)

---

## 📦 Phase 2: WA-Webhook Consolidation (Week 4-6)

### Target: Merge 4 Functions into wa-webhook-unified

**Functions to Consolidate**:

1. **wa-webhook-ai-agents** (241 lines, 7.8KB)
   - **Deployed**: Version 530 (Dec 2, 2025)
   - **Status**: ACTIVE but redundant with wa-webhook-unified
   - **Action**: Merge domain routing into unified
   - **Risk**: LOW (already covered by unified)

2. **wa-webhook-jobs** (614 lines, 20KB)
   - **Deployed**: Version 477 (Dec 2, 2025)
   - **Status**: ACTIVE, job board integration
   - **Action**: Migrate job domain to unified
   - **Risk**: MEDIUM (active but not critical)

3. **wa-webhook-marketplace** (715 lines, 23KB)
   - **Deployed**: Version 314 (Dec 2, 2025)
   - **Status**: ACTIVE, buy/sell features
   - **Action**: Migrate marketplace domain to unified
   - **Risk**: MEDIUM (active but not critical)

4. **wa-webhook-property** (525 lines, 16KB)
   - **Deployed**: Version 429 (Dec 1, 2025)
   - **Status**: ACTIVE, real estate features
   - **Action**: Migrate property domain to unified
   - **Risk**: MEDIUM (active but not critical)

### Current wa-webhook-unified Status
- **Lines**: 364 lines (12KB)
- **Version**: 209 (deployed Dec 3, 2025)
- **Already Covers**: Farmer, Waiter, Support agents
- **Needs Integration**: Jobs, Marketplace, Property domains

---

## 🗑️ Phase 3: Delete Inactive Functions (Week 4)

### Batch 1: Confirmed Inactive (1+ month, no refs)

**Already in .archive/inactive-functions-20251203/**:
```bash
# Delete from Supabase (NOT in current functions list, safe)
supabase functions delete admin-subscriptions
supabase functions delete campaign-dispatch  
supabase functions delete cart-reminder
supabase functions delete flow-exchange
supabase functions delete flow-exchange-mock
supabase functions delete housekeeping
supabase functions delete order-pending-reminder
supabase functions delete simulator
supabase functions delete wa-webhook-diag
```

**Total**: 9 functions

### Batch 2: Low-Activity Analytics (Check First)

**Candidates** (verify usage before delete):
```bash
# CHECK scheduled jobs/cron before deleting
supabase functions delete agent-doc-embed         # 1 month inactive
supabase functions delete agent-doc-search        # 1 month inactive  
supabase functions delete insurance-media-fetch   # 1 month inactive
supabase functions delete video-performance-summary # 13 days ago
```

**Action Required**: 
1. Check Supabase cron jobs: `SELECT * FROM cron.job WHERE command LIKE '%video-performance%'`
2. Check insurance OCR workflow for media-fetch dependency
3. Check RAG pipeline for doc-embed/search usage

**Total**: 4 functions (verify first)

---

## 📅 Week-by-Week Implementation Plan

### **WEEK 4** (Dec 4-10, 2025): Preparation & Cleanup

**Goals**:
- Delete archived agent functions from Supabase
- Delete inactive Batch 1 functions
- Enhance wa-webhook-unified with routing table
- Set up A/B testing infrastructure

**Tasks**:

#### Day 1-2: Remote Deletion
```bash
# Step 1: Delete archived agent functions (13 total)
cd /Users/jeanbosco/workspace/easymo

supabase functions delete agent-chat --project-ref YOUR_PROJECT
supabase functions delete agent-config-invalidator --project-ref YOUR_PROJECT
supabase functions delete agent-monitor --project-ref YOUR_PROJECT
supabase functions delete agent-negotiation --project-ref YOUR_PROJECT
supabase functions delete agent-property-rental --project-ref YOUR_PROJECT
supabase functions delete agent-quincaillerie --project-ref YOUR_PROJECT
supabase functions delete agent-runner --project-ref YOUR_PROJECT
supabase functions delete agent-schedule-trip --project-ref YOUR_PROJECT
supabase functions delete agent-shops --project-ref YOUR_PROJECT
supabase functions delete agent-tools-general-broker --project-ref YOUR_PROJECT
supabase functions delete agents --project-ref YOUR_PROJECT
supabase functions delete job-board-ai-agent --project-ref YOUR_PROJECT
supabase functions delete waiter-ai-agent --project-ref YOUR_PROJECT

# Step 2: Delete inactive Batch 1 (9 total)
supabase functions delete admin-subscriptions --project-ref YOUR_PROJECT
supabase functions delete campaign-dispatch --project-ref YOUR_PROJECT
supabase functions delete cart-reminder --project-ref YOUR_PROJECT
supabase functions delete flow-exchange --project-ref YOUR_PROJECT
supabase functions delete flow-exchange-mock --project-ref YOUR_PROJECT
supabase functions delete housekeeping --project-ref YOUR_PROJECT
supabase functions delete order-pending-reminder --project-ref YOUR_PROJECT
supabase functions delete simulator --project-ref YOUR_PROJECT
supabase functions delete wa-webhook-diag --project-ref YOUR_PROJECT
```

#### Day 3-4: Add Routing to wa-webhook-unified
```typescript
// supabase/functions/wa-webhook-unified/core/domain-router.ts
export const DOMAIN_ROUTES = {
  'jobs': {
    keywords: ['job', 'employment', 'hire', 'career', 'vacancy'],
    agent: 'job-board',
    fallbackFunction: 'wa-webhook-jobs' // Week 4: still active
  },
  'marketplace': {
    keywords: ['buy', 'sell', 'shop', 'product', 'store'],
    agent: 'marketplace',
    fallbackFunction: 'wa-webhook-marketplace' // Week 4: still active
  },
  'property': {
    keywords: ['rent', 'house', 'apartment', 'real estate', 'landlord'],
    agent: 'property-rental',
    fallbackFunction: 'wa-webhook-property' // Week 4: still active
  }
};
```

#### Day 5: Deploy Enhanced Unified
```bash
supabase functions deploy wa-webhook-unified --no-verify-jwt
```

#### Day 6-7: Database Migration
```sql
-- supabase/migrations/20251204_add_webhook_routing.sql
BEGIN;

CREATE TABLE IF NOT EXISTS webhook_routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  target_function TEXT NOT NULL,
  traffic_percentage INTEGER DEFAULT 0 CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO webhook_routing_config (domain, target_function, traffic_percentage) VALUES
  ('jobs', 'wa-webhook-unified', 10),
  ('marketplace', 'wa-webhook-unified', 10),
  ('property', 'wa-webhook-unified', 10),
  ('ai-agents', 'wa-webhook-unified', 10);

CREATE TABLE IF NOT EXISTS webhook_routing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  source_function TEXT NOT NULL,
  target_function TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  message_id TEXT,
  routed_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN,
  error_message TEXT
);

CREATE INDEX idx_routing_logs_domain ON webhook_routing_logs(domain, routed_at DESC);

COMMIT;
```

```bash
supabase db push
```

**Week 4 Deliverables**:
- ✅ 22 functions deleted from Supabase (13 agents + 9 inactive)
- ✅ wa-webhook-unified enhanced with 4 domain routes
- ✅ Routing config table deployed
- ✅ Ready for 10% traffic test

---

### **WEEK 5** (Dec 11-17, 2025): 10% Traffic Migration

**Goals**:
- Route 10% of jobs/marketplace/property/ai-agents traffic to unified
- Monitor error rates, latency, success rates
- Rollback capability active

**Tasks**:

#### Day 1: Enable 10% Routing
```sql
-- Run in Supabase SQL Editor
UPDATE webhook_routing_config 
SET traffic_percentage = 10, enabled = true
WHERE domain IN ('jobs', 'marketplace', 'property', 'ai-agents');
```

#### Day 2-7: Monitoring
```typescript
// Add to wa-webhook-unified/index.ts
import { logStructuredEvent } from "../_shared/observability.ts";

async function routeWithMetrics(domain: string, data: any) {
  const startTime = Date.now();
  
  try {
    const result = await orchestrator.process(domain, data);
    const latency = Date.now() - startTime;
    
    await logStructuredEvent("WEBHOOK_ROUTED", {
      domain,
      target: "wa-webhook-unified",
      latency,
      success: true
    });
    
    return result;
  } catch (error) {
    await logStructuredEvent("WEBHOOK_ROUTE_FAILED", {
      domain,
      target: "wa-webhook-unified",
      error: error.message
    });
    throw error;
  }
}
```

**Monitoring Queries**:
```sql
-- Success rate per domain
SELECT 
  domain,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM webhook_routing_logs
WHERE routed_at > NOW() - INTERVAL '24 hours'
GROUP BY domain;

-- Average latency
SELECT 
  domain,
  target_function,
  COUNT(*) as requests,
  AVG(latency_ms) as avg_latency_ms,
  MAX(latency_ms) as max_latency_ms
FROM webhook_routing_logs
WHERE routed_at > NOW() - INTERVAL '1 hour'
GROUP BY domain, target_function;
```

**Success Criteria**:
- Success rate ≥ 99%
- Latency < 2000ms (p95)
- No increase in DLQ entries
- Zero data loss

**Rollback Plan**:
```sql
-- Emergency rollback
UPDATE webhook_routing_config 
SET traffic_percentage = 0, enabled = false
WHERE domain IN ('jobs', 'marketplace', 'property', 'ai-agents');
```

**Week 5 Deliverables**:
- ✅ 10% traffic successfully routed to unified
- ✅ Monitoring dashboards active
- ✅ Zero critical incidents
- ✅ Ready for 50% scale-up

---

### **WEEK 6** (Dec 18-24, 2025): 50% Traffic Migration

**Goals**:
- Scale to 50% traffic
- Validate performance under load
- Prepare for full migration

**Tasks**:

#### Day 1: Scale to 50%
```sql
UPDATE webhook_routing_config 
SET traffic_percentage = 50
WHERE domain IN ('jobs', 'marketplace', 'property', 'ai-agents');
```

#### Day 2-7: Enhanced Monitoring
```bash
# Check function invocations
supabase functions list | grep wa-webhook

# Check error rates
supabase functions logs wa-webhook-unified --tail 100 | grep ERROR

# Performance comparison
supabase functions logs wa-webhook-jobs --tail 100 &
supabase functions logs wa-webhook-unified --tail 100 &
```

**Load Testing**:
```typescript
// tests/load-test-unified.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("wa-webhook-unified handles 100 req/min", async () => {
  const requests = Array.from({ length: 100 }, (_, i) => 
    fetch("https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-unified", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: "jobs",
        message: { text: `Test job query ${i}` }
      })
    })
  );
  
  const responses = await Promise.all(requests);
  const successCount = responses.filter(r => r.ok).length;
  
  assertEquals(successCount, 100, "All requests should succeed");
});
```

**Success Criteria**:
- Success rate ≥ 99.5%
- Latency < 1500ms (p95)
- No memory leaks (monitor Deno memory)
- Cost within budget

**Week 6 Deliverables**:
- ✅ 50% traffic migrated successfully
- ✅ Performance validated under load
- ✅ Cost analysis complete
- ✅ Ready for 100% migration

---

### **WEEK 7** (Dec 25-31, 2025): 100% Migration & Deprecation

**Goals**:
- Route 100% traffic to wa-webhook-unified
- Deprecate 4 old webhook functions
- Monitor for 7 days before deletion

**Tasks**:

#### Day 1: Full Migration
```sql
UPDATE webhook_routing_config 
SET traffic_percentage = 100
WHERE domain IN ('jobs', 'marketplace', 'property', 'ai-agents');
```

#### Day 2-7: Validation Period
```sql
-- Verify old functions receive no traffic
SELECT 
  function_name,
  COUNT(*) as invocations,
  MAX(invoked_at) as last_invocation
FROM function_invocation_logs
WHERE function_name IN (
  'wa-webhook-jobs',
  'wa-webhook-marketplace', 
  'wa-webhook-property',
  'wa-webhook-ai-agents'
)
AND invoked_at > NOW() - INTERVAL '7 days'
GROUP BY function_name;
```

#### Day 7: Mark for Deletion
```bash
# Move to archive
mkdir -p .archive/wa-webhook-deprecated-20251231
mv supabase/functions/wa-webhook-jobs .archive/wa-webhook-deprecated-20251231/
mv supabase/functions/wa-webhook-marketplace .archive/wa-webhook-deprecated-20251231/
mv supabase/functions/wa-webhook-property .archive/wa-webhook-deprecated-20251231/
mv supabase/functions/wa-webhook-ai-agents .archive/wa-webhook-deprecated-20251231/

# Git commit
git add .archive/wa-webhook-deprecated-20251231/
git add supabase/functions/
git commit -m "chore: archive deprecated wa-webhook functions (jobs, marketplace, property, ai-agents)"
git push origin main
```

**Week 7 Deliverables**:
- ✅ 100% traffic on wa-webhook-unified
- ✅ 4 old webhooks deprecated and archived
- ✅ 7-day validation complete
- ✅ Ready for final deletion

---

### **WEEK 8** (Jan 1-7, 2026): Final Deletion & Verification

**Goals**:
- Delete 4 deprecated webhooks from Supabase
- Verify final function count
- Document consolidation results

**Tasks**:

#### Day 1: Delete from Supabase
```bash
# FINAL DELETION (after 7-day archive period)
supabase functions delete wa-webhook-jobs --project-ref YOUR_PROJECT
supabase functions delete wa-webhook-marketplace --project-ref YOUR_PROJECT
supabase functions delete wa-webhook-property --project-ref YOUR_PROJECT
supabase functions delete wa-webhook-ai-agents --project-ref YOUR_PROJECT
```

#### Day 2: Verify Function Count
```bash
# Should show 64 functions (down from 78)
supabase functions list | wc -l

# Verify remaining wa-webhook functions
supabase functions list | grep wa-webhook
```

**Expected Output**:
```
wa-webhook                  (120 lines) - Legacy router
wa-webhook-core            (248 lines) - Core handler
wa-webhook-insurance       (398 lines) - PRODUCTION ✅
wa-webhook-mobility        (585 lines) - PRODUCTION ✅
wa-webhook-profile        (1142 lines) - PRODUCTION ✅
wa-webhook-unified         (364 lines) - Consolidated unified
wa-webhook-wallet          (195 lines) - Wallet operations
```

**Total**: 7 wa-webhook functions (down from 11)

#### Day 3-7: Documentation & Cleanup
```bash
# Update function inventory
cat > supabase/functions/FUNCTIONS_INVENTORY.md << 'EOF'
# Supabase Functions Inventory
**Last Updated**: January 7, 2026
**Total Functions**: 64

## WA-Webhook Functions (7)
- wa-webhook (legacy router)
- wa-webhook-core (base handler)
- wa-webhook-insurance ⚡ PRODUCTION
- wa-webhook-mobility ⚡ PRODUCTION
- wa-webhook-profile ⚡ PRODUCTION
- wa-webhook-unified (consolidated: jobs, marketplace, property, ai-agents)
- wa-webhook-wallet

## Deleted (26 total)
### Agent Duplicates (13)
- agent-chat, agent-config-invalidator, agent-monitor, etc.

### Inactive Functions (9)
- admin-subscriptions, campaign-dispatch, cart-reminder, etc.

### Consolidated (4)
- wa-webhook-jobs → wa-webhook-unified
- wa-webhook-marketplace → wa-webhook-unified
- wa-webhook-property → wa-webhook-unified
- wa-webhook-ai-agents → wa-webhook-unified
EOF

git add supabase/functions/FUNCTIONS_INVENTORY.md
git commit -m "docs: update functions inventory post-consolidation"
git push origin main
```

**Week 8 Deliverables**:
- ✅ 26 functions deleted (13 agents + 9 inactive + 4 webhooks)
- ✅ Final count: 64 functions (18% reduction)
- ✅ Documentation updated
- ✅ Consolidation complete

---

## 📊 Final Summary

### Deletion List (26 Functions Total)

#### ✅ Agent Duplicates (13) - DELETED Week 4
```
agent-chat
agent-config-invalidator
agent-monitor
agent-negotiation
agent-property-rental
agent-quincaillerie
agent-runner
agent-schedule-trip
agent-shops
agent-tools-general-broker
agents
job-board-ai-agent
waiter-ai-agent
```

#### ✅ Inactive Functions (9) - DELETED Week 4
```
admin-subscriptions
campaign-dispatch
cart-reminder
flow-exchange
flow-exchange-mock
housekeeping
order-pending-reminder
simulator
wa-webhook-diag
```

#### ✅ Consolidated Webhooks (4) - DELETED Week 8
```
wa-webhook-jobs → wa-webhook-unified
wa-webhook-marketplace → wa-webhook-unified
wa-webhook-property → wa-webhook-unified
wa-webhook-ai-agents → wa-webhook-unified
```

### Before/After Comparison

| Category | Before | After | Change |
|----------|--------|-------|--------|
| **Total Functions** | 78 | 64 | -14 (-18%) |
| **WA-Webhooks** | 11 | 7 | -4 (-36%) |
| **Agent Functions** | 13 | 0 | -13 (-100%) |
| **Inactive** | 9 | 0 | -9 (-100%) |
| **Protected (Prod)** | 3 | 3 | 0 (unchanged) |

### Cost Impact
- **Compute**: -26 function slots = ~30% reduction in idle cost
- **Cold Starts**: Consolidated routing reduces cold start frequency
- **Maintenance**: Single codebase for 4 domains (jobs, marketplace, property, ai-agents)

### Risk Mitigation
✅ Production webhooks untouched (mobility, profile, insurance)  
✅ Progressive traffic migration (10% → 50% → 100%)  
✅ 7-day validation before deletion  
✅ Rollback capability at each stage  
✅ Archived code preserved in `.archive/`

---

## 🚀 Autonomous Execution Commands

### Week 4: Preparation & Cleanup
```bash
#!/bin/bash
# week4-consolidation.sh

echo "Week 4: Delete archived agents and inactive functions"

# Delete 13 agent functions
for func in agent-chat agent-config-invalidator agent-monitor agent-negotiation \
            agent-property-rental agent-quincaillerie agent-runner agent-schedule-trip \
            agent-shops agent-tools-general-broker agents job-board-ai-agent waiter-ai-agent; do
  echo "Deleting $func..."
  supabase functions delete $func --project-ref YOUR_PROJECT || echo "Already deleted or not found"
done

# Delete 9 inactive functions
for func in admin-subscriptions campaign-dispatch cart-reminder flow-exchange \
            flow-exchange-mock housekeeping order-pending-reminder simulator wa-webhook-diag; do
  echo "Deleting $func..."
  supabase functions delete $func --project-ref YOUR_PROJECT || echo "Already deleted or not found"
done

# Deploy enhanced unified
supabase functions deploy wa-webhook-unified --no-verify-jwt

# Push DB migration
supabase db push

echo "Week 4 complete: 22 functions deleted, routing table deployed"
```

### Week 5: 10% Traffic
```bash
#!/bin/bash
# week5-10percent.sh

echo "Week 5: Route 10% traffic to unified"

# Enable 10% routing via SQL
supabase db execute --sql "
UPDATE webhook_routing_config 
SET traffic_percentage = 10, enabled = true
WHERE domain IN ('jobs', 'marketplace', 'property', 'ai-agents');
"

echo "Week 5 complete: 10% traffic routed. Monitor for 7 days."
```

### Week 6: 50% Traffic
```bash
#!/bin/bash
# week6-50percent.sh

echo "Week 6: Scale to 50% traffic"

supabase db execute --sql "
UPDATE webhook_routing_config 
SET traffic_percentage = 50
WHERE domain IN ('jobs', 'marketplace', 'property', 'ai-agents');
"

echo "Week 6 complete: 50% traffic routed. Monitor for 7 days."
```

### Week 7: 100% Migration
```bash
#!/bin/bash
# week7-100percent.sh

echo "Week 7: Full migration to unified"

supabase db execute --sql "
UPDATE webhook_routing_config 
SET traffic_percentage = 100
WHERE domain IN ('jobs', 'marketplace', 'property', 'ai-agents');
"

# Archive old functions
mkdir -p .archive/wa-webhook-deprecated-20251231
mv supabase/functions/wa-webhook-jobs .archive/wa-webhook-deprecated-20251231/
mv supabase/functions/wa-webhook-marketplace .archive/wa-webhook-deprecated-20251231/
mv supabase/functions/wa-webhook-property .archive/wa-webhook-deprecated-20251231/
mv supabase/functions/wa-webhook-ai-agents .archive/wa-webhook-deprecated-20251231/

git add .archive/ supabase/functions/
git commit -m "chore: archive deprecated wa-webhook functions"
git push origin main

echo "Week 7 complete: 100% traffic migrated, 4 functions archived"
```

### Week 8: Final Deletion
```bash
#!/bin/bash
# week8-final-delete.sh

echo "Week 8: Final deletion of deprecated webhooks"

# Delete from Supabase
for func in wa-webhook-jobs wa-webhook-marketplace wa-webhook-property wa-webhook-ai-agents; do
  echo "Deleting $func..."
  supabase functions delete $func --project-ref YOUR_PROJECT
done

# Verify count
echo "Final function count:"
supabase functions list | wc -l

echo "Week 8 complete: Consolidation finished. 26 functions deleted total."
```

---

## 📈 Success Metrics

### Technical Metrics
- [ ] Function count reduced from 78 to 64
- [ ] 26 functions deleted (13 agents + 9 inactive + 4 webhooks)
- [ ] Success rate maintained ≥ 99.5%
- [ ] Latency p95 < 1500ms
- [ ] Zero data loss incidents

### Business Metrics
- [ ] Compute cost reduced ~30%
- [ ] Maintenance overhead reduced (4 codebases → 1)
- [ ] Cold start frequency reduced
- [ ] Developer onboarding time reduced

### Risk Metrics
- [ ] Production webhooks unchanged (mobility, profile, insurance)
- [ ] Zero rollbacks required
- [ ] All traffic successfully migrated
- [ ] Archived code preserved for rollback

---

## 🔧 Rollback Procedures

### Emergency Rollback (Any Week)
```sql
-- Immediate traffic revert
UPDATE webhook_routing_config 
SET traffic_percentage = 0, enabled = false;

-- Restore archived functions
cp -r .archive/wa-webhook-deprecated-20251231/* supabase/functions/
supabase functions deploy wa-webhook-jobs --no-verify-jwt
supabase functions deploy wa-webhook-marketplace --no-verify-jwt
supabase functions deploy wa-webhook-property --no-verify-jwt
supabase functions deploy wa-webhook-ai-agents --no-verify-jwt
```

### Partial Rollback (Single Domain)
```sql
-- Revert only jobs domain
UPDATE webhook_routing_config 
SET traffic_percentage = 0
WHERE domain = 'jobs';
```

---

## 📝 Post-Implementation Tasks

1. **Update Documentation**
   - [ ] Update FUNCTIONS_INVENTORY.md
   - [ ] Update ARCHITECTURE.md with new routing
   - [ ] Document monitoring dashboards

2. **Team Training**
   - [ ] Train team on wa-webhook-unified architecture
   - [ ] Update runbooks with new routing logic
   - [ ] Create troubleshooting guide

3. **Monitoring Setup**
   - [ ] Configure alerts for routing failures
   - [ ] Set up latency dashboards
   - [ ] Create cost tracking reports

4. **Code Cleanup**
   - [ ] Remove dead imports from archived functions
   - [ ] Update tests to use unified endpoint
   - [ ] Clean up environment variables

---

**Prepared by**: AI Consolidation Agent  
**Approved by**: [Pending Human Review]  
**Implementation Start**: Week 4 (Dec 4, 2025)  
**Expected Completion**: Week 8 (Jan 7, 2026)
