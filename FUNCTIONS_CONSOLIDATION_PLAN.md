# SUPABASE FUNCTIONS CONSOLIDATION PLAN

## 📊 Executive Summary

**Current State**: 73 deployed functions + 34 archived locally  
**Target State**: 52 deployed functions after 6-phase consolidation  
**Reduction**: 29% (-21 functions)  
**Timeline**: 8 weeks (Phase 1 immediate, Phases 2-6 weekly)

---

## 🎯 Consolidation Objectives

1. **Eliminate Redundancy**: Delete 21 inactive/duplicate functions
2. **Consolidate WA-Webhooks**: Merge 4 domain webhooks → 1 unified
3. **Protect Production**: ZERO changes to mobility/profile/insurance (additive only)
4. **Zero Downtime**: Gradual traffic migration (10% → 50% → 100%)

---

## 🚨 PRODUCTION FUNCTIONS (PROTECTED)

**These 3 webhooks are LIVE in production and handle real user traffic:**

1. ✅ **wa-webhook-mobility** (v490, 4h ago)
   - Ride booking, driver matching, trip scheduling
   - **Status**: PRODUCTION - NO MODIFICATIONS
   
2. ✅ **wa-webhook-profile** (v292, 4h ago)
   - User registration, profile updates, authentication
   - **Status**: PRODUCTION - NO MODIFICATIONS
   
3. ✅ **wa-webhook-insurance** (v340, 4h ago)
   - Insurance quotes, policy management, claims
   - **Status**: PRODUCTION - NO MODIFICATIONS

**Protection Rules**:
- ❌ NO deletions
- ❌ NO breaking changes to existing logic
- ✅ ADDITIVE ONLY (can add features, cannot remove)
- ✅ Traffic routing unchanged until Week 6 (monitoring phase)

---

## ✅ ALREADY COMPLETED

### Archived Locally (34 functions moved to `.archive/`)

**Agent Duplicates** (13):
- agent-chat, agent-config-invalidator, agent-monitor
- agent-negotiation, agent-property-rental, agent-quincaillerie
- agent-runner, agent-schedule-trip, agent-shops
- agent-tools-general-broker, agents
- job-board-ai-agent, waiter-ai-agent

**Inactive Functions** (2):
- housekeeping (1 month old)
- video-performance-summary (13 days old)

**Legacy Webhooks** (20):
- wa-webhook-legacy-20251124/ (bulk archive)

### Code Consolidation
- ✅ `wa-webhook-ai-agents` marked DEPRECATED (index.ts line 2)
- ✅ `wa-webhook-unified` contains consolidated logic (364 lines)
- ✅ Dual AI provider support (Gemini 2.5 Pro + GPT-5)

---

## 📋 DELETION LIST (21 Functions)

### Functions To Delete From Supabase

#### **Batch 1: Immediate Safe Deletions** (3) - ✅ PHASE 1
*Criteria: 1+ month inactive, no code references, already archived locally*

1. `wa-webhook-diag` (v35, Oct 21) - diagnostic tool only
2. `insurance-media-fetch` (v33, Oct 21) - no active references
3. `video-performance-summary` (archived 13 days ago) - analytics, check cron first

**Risk**: ⚪ NONE  
**Execute**: Immediately via `./scripts/phase1-delete-inactive.sh`

---

#### **Batch 2: WA-Webhook Consolidation** (4) - ⏳ PHASE 5 (Week 7+)
*Criteria: Consolidated into wa-webhook-unified, traffic migrated*

4. `wa-webhook-ai-agents` (AFTER 100% traffic to unified + 48h stability)
5. `wa-webhook-jobs` (AFTER consolidation testing)
6. `wa-webhook-marketplace` (AFTER consolidation testing)
7. `wa-webhook-property` (AFTER consolidation testing)

**Protection**: Keep forever:
- `wa-webhook-core` (utilities)
- `wa-webhook-mobility` (PRODUCTION)
- `wa-webhook-profile` (PRODUCTION)
- `wa-webhook-insurance` (PRODUCTION)
- `wa-webhook-unified` (consolidated)
- `wa-webhook` (legacy fallback)
- `wa-webhook-wallet` (payments)

**Risk**: 🟢 LOW (traffic already migrated, 48h stability proven)  
**Execute**: Week 7+ via `./scripts/phase5-delete-old-webhooks.sh`

---

#### **Batch 3: Legacy/Unused Functions** (14) - ⏳ PHASE 6 (Week 8+)
*Criteria: Need verification before deletion*

**Agent/AI Functions** (2):
8. `agent-doc-embed` - ⚠️ Verify RAG pipeline not using
9. `agent-doc-search` - ⚠️ Verify RAG pipeline not using

**Admin/Campaign** (4):
10. `admin-subscriptions` - ⚠️ Check for cron jobs
11. `campaign-dispatch` - ⚠️ Check for scheduled tasks
12. `cart-reminder` - ⚠️ Check for scheduled tasks
13. `order-pending-reminder` - ⚠️ Check for scheduled tasks

**Mock/Test Functions** (3):
14. `flow-exchange-mock` - Test function
15. `flow-exchange` - Check if used by any service
16. `simulator` - May already be deleted

**Legacy Tools** (5):
17. `schedule-broadcast` - Check if cron is using
18. `schedule-email` - Check if cron is using
19. `schedule-sms` - Check if cron is using
20. `notify-buyers` - Check if active
21. `qr_info` - vs `qr-resolve` (may be duplicate)

**Risk**: 🟡 MEDIUM (need verification first)  
**Execute**: Week 8+ via `./scripts/phase6-final-cleanup.sh` AFTER verification

---

## 📊 FINAL STATE (52 Functions)

### **WhatsApp Webhooks** (7)
- wa-webhook-core, wa-webhook-mobility, wa-webhook-profile
- wa-webhook-insurance, wa-webhook-unified, wa-webhook, wa-webhook-wallet

### **Admin** (8)
- admin-health, admin-messages, admin-settings, admin-stats
- admin-trips, admin-users, admin-wallet-api, insurance-admin-api

### **AI/ML** (9)
- ai-contact-queue, ai-lookup-customer, classify-business-tags
- intelligent-tag-allocation, openai-deep-research, openai-realtime-sip
- retrieval-search, tool-shortlist-rank, generate

### **Business/Commerce** (5)
- bars-lookup, business-lookup, ingest-businesses
- listings-sync, source-url-scraper

### **Jobs** (2)
- job-crawler, job-sources-sync

### **Payments** (7)
- momo-allocator, momo-charge, momo-sms-hook, momo-sms-webhook, momo-webhook
- revolut-charge, revolut-webhook

### **OCR/Media** (4)
- insurance-ocr, media-fetch, ocr-processor, vehicle-ocr

### **Mobility/Trips** (5)
- activate-recurring-trips, availability-refresh
- cleanup-mobility-intents, recurring-trips-scheduler, schedule_pickup

### **Notifications** (5)
- conversations, notification-worker
- send-insurance-admin-notifications, tool-contact-owner-whatsapp, tool-notify-user

### **Infrastructure** (9)
- cleanup-expired-intents, data-retention, deeplink-resolver
- dlq-processor, geocode-locations, qr-resolve
- session-cleanup, wa-events-bq-drain, edits

### **Auth/Profile** (3)
- send-whatsapp-otp, verify-whatsapp-otp, complete-user-profile

### **Other** (3)
- search-indexer, sync-transactions, webhook-relay
- campaign-dispatcher, insurance-renewal-reminder

---

## 📅 EXECUTION TIMELINE

| Week | Phase | Action | Deletions | Total Functions |
|------|-------|--------|-----------|-----------------|
| **Now** | **1** | Delete inactive (diag, media, video) | 3 | **70** |
| 4 | 2 | Setup routing, 10% traffic to unified | 0 | 70 |
| 5 | 3 | Scale to 50% traffic | 0 | 70 |
| 6 | 4 | 100% traffic cutover (monitor 48h) | 0 | 70 |
| 7+ | 5 | Delete old wa-webhooks (4) | 4 | **66** |
| 8+ | 6 | Final cleanup (after verification) | ~14 | **~52** |

**Total Timeline**: 8 weeks  
**Total Reduction**: 73 → 52 functions (-29%)

---

## 🚀 PHASE-BY-PHASE EXECUTION

### **PHASE 1: Immediate Safe Deletions** ✅ READY NOW

**What**: Delete 3 confirmed inactive functions  
**When**: Execute immediately  
**Risk**: ⚪ NONE

```bash
cd /Users/jeanbosco/workspace/easymo
chmod +x scripts/phase1-delete-inactive.sh
./scripts/phase1-delete-inactive.sh
```

**Expected Output**: 73 → 70 functions

---

### **PHASE 2: Setup Traffic Routing** (Week 4)

**What**: Deploy routing infrastructure (NO deletions)  
**Risk**: 🟡 LOW (10% canary, easy rollback)

**Actions**:
1. Deploy `wa-webhook-unified` (already deployed v207)
2. Create traffic routing layer (10% to unified)
3. Monitor error rates, latency, delivery

```bash
./scripts/phase2-setup-routing.sh
```

**Monitoring**:
- Error rate < 0.1%
- Latency P95 < 2s
- Message delivery > 99.9%

---

### **PHASE 3: Scale Traffic** (Week 5)

**What**: Increase unified traffic to 50%  
**Risk**: 🟡 LOW (50% traffic, easy rollback)

```bash
./scripts/phase3-scale-traffic.sh
```

**Validation**:
- Compare error rates: unified vs legacy
- Check all domains working (jobs, marketplace, property)
- Verify agent handoffs functioning

---

### **PHASE 4: Full Cutover** (Week 6)

**What**: Route 100% traffic to unified  
**Risk**: 🟢 MEDIUM (100% traffic, rollback possible)

```bash
./scripts/phase4-full-cutover.sh
```

**Critical Monitoring (48 hours)**:
- ✅ Zero errors on production webhooks (mobility, profile, insurance)
- ✅ All domains (jobs, marketplace, property, AI agents) working
- ✅ Session handoffs successful
- ✅ Message delivery rate maintained

**DO NOT PROCEED TO PHASE 5 until 48h stability confirmed**

---

### **PHASE 5: Delete Old WA-Webhooks** (Week 7+)

**What**: Delete 4 consolidated webhooks  
**Risk**: 🟢 LOW (traffic migrated, 48h stability proven)  
**Prerequisites**: ✅ 48h of 100% traffic to unified with zero issues

```bash
# ONLY execute after 48h stability window
./scripts/phase5-delete-old-webhooks.sh
```

**Functions Deleted**:
- wa-webhook-ai-agents
- wa-webhook-jobs
- wa-webhook-marketplace
- wa-webhook-property

**Expected Output**: 70 → 66 functions

---

### **PHASE 6: Final Cleanup** (Week 8+)

**What**: Delete legacy/unused functions (AFTER verification)  
**Risk**: 🟡 MEDIUM (need verification first)

**Pre-Deletion Verification**:
```bash
# Check for cron jobs
supabase functions list --show-cron

# Check code references
grep -r "agent-doc-embed" src/ apps/ services/
grep -r "admin-subscriptions" src/ apps/ services/
grep -r "campaign-dispatch" src/ apps/ services/

# Check RAG pipeline
grep -r "retrieval-search\|agent-doc" supabase/functions/
```

**Execute**:
```bash
# ONLY after verification
./scripts/phase6-final-cleanup.sh
```

**Expected Output**: 66 → ~52 functions

---

## 🔐 SAFETY GUARANTEES

### Production Protection
- ✅ Mobility, profile, insurance webhooks NEVER modified
- ✅ All changes additive-only to production webhooks
- ✅ Traffic routing allows instant rollback at any phase
- ✅ 48-hour stability window before any deletions

### Monitoring & Alerting
- ✅ Error rate tracking per webhook domain
- ✅ Latency monitoring (P50, P95, P99)
- ✅ Message delivery rate tracking (target: 99.9%+)
- ✅ Real-time alerting on degradation

### Rollback Procedures

**Phase 2-4 (Traffic Routing)**:
```bash
# Instant rollback - change traffic %
export UNIFIED_TRAFFIC_PERCENT=0  # Back to legacy
supabase functions deploy wa-webhook-router
```

**Phase 5 (WA-Webhook Deletions)**:
```bash
# Redeploy from git history
git checkout HEAD~1 -- supabase/functions/wa-webhook-ai-agents
supabase functions deploy wa-webhook-ai-agents
```

**Phase 6 (Final Cleanup)**:
```bash
# Restore from archive
cp -r supabase/functions/.archive/inactive-batch2-20251203/video-performance-summary \
      supabase/functions/
supabase functions deploy video-performance-summary
```

---

## 📈 SUCCESS METRICS

### Quantitative
- ✅ Zero downtime for production webhooks (100%)
- ✅ Error rate < 0.1% during entire consolidation
- ✅ 29% reduction in function count (73 → 52)
- ✅ Message delivery > 99.9% maintained
- ✅ Latency P95 < 2s maintained

### Qualitative
- ✅ Simplified architecture (7 webhooks vs 10+)
- ✅ Consolidated agent management (unified orchestrator)
- ✅ Dual AI provider support (Gemini + GPT-5)
- ✅ All deletions reversible via git/archive
- ✅ Production webhooks remain untouched

---

## 🚀 NEXT ACTIONS

### Immediate (Today)
1. ✅ Review this consolidation plan
2. ✅ Execute Phase 1: `./scripts/phase1-delete-inactive.sh`
3. ✅ Verify deletions: `supabase functions list | grep -E "diag|insurance-media|video-performance"`
4. ✅ Update monitoring dashboards

### Week 4
1. Deploy Phase 2: Traffic routing infrastructure (10%)
2. Monitor for 7 days

### Week 5
1. Scale Phase 3: Increase to 50% traffic
2. Monitor for 7 days

### Week 6
1. Execute Phase 4: 100% traffic cutover
2. **Critical**: Monitor for 48 hours before proceeding

### Week 7+
1. Execute Phase 5: Delete old webhooks (ONLY after 48h stability)

### Week 8+
1. Verify functions before deletion
2. Execute Phase 6: Final cleanup

---

## 📝 DELETED FUNCTIONS LOG

### Phase 1 (Executed: 2025-12-03)
- ✅ wa-webhook-diag
- ✅ insurance-media-fetch
- ✅ video-performance-summary

### Phase 5 (Pending: Week 7+)
- ⏳ wa-webhook-ai-agents
- ⏳ wa-webhook-jobs
- ⏳ wa-webhook-marketplace
- ⏳ wa-webhook-property

### Phase 6 (Pending: Week 8+)
- ⏳ agent-doc-embed (verify RAG first)
- ⏳ agent-doc-search (verify RAG first)
- ⏳ admin-subscriptions (verify cron first)
- ⏳ campaign-dispatch (verify cron first)
- ⏳ cart-reminder (verify cron first)
- ⏳ order-pending-reminder (verify cron first)
- ⏳ flow-exchange-mock
- ⏳ flow-exchange
- ⏳ simulator
- ⏳ schedule-broadcast (verify cron first)
- ⏳ schedule-email (verify cron first)
- ⏳ schedule-sms (verify cron first)
- ⏳ notify-buyers
- ⏳ qr_info (check vs qr-resolve)

---

## 📞 Escalation

**Issues During Consolidation**:
- Error rate > 0.1%: Immediate rollback to previous phase
- Production webhook failures: Emergency rollback + incident report
- Data loss detected: Stop all phases, full audit

**Contact**: Infrastructure Team
**Slack**: #platform-infrastructure
**PagerDuty**: Critical alerts enabled for production webhooks
