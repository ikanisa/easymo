# SUPABASE FUNCTIONS CONSOLIDATION - DELETION LIST

## 🗑️ PHASE 1: DELETED FROM PRODUCTION (✅ COMPLETE)

**Executed**: December 3, 2025  
**Status**: ✅ SUCCESS

1. ✅ **wa-webhook-diag** (deleted successfully)
2. ✅ **insurance-media-fetch** (deleted successfully)  
3. ⚠️ **video-performance-summary** (already deleted earlier)

**Result**: 73 → 71 functions (-2)

---

## 📁 ALREADY ARCHIVED LOCALLY (34 Functions - NOT in Production)

### Agent Duplicates (13) - `.archive/agent-duplicates-20251203/`
1. agent-chat
2. agent-config-invalidator
3. agent-monitor
4. agent-negotiation
5. agent-property-rental
6. agent-quincaillerie
7. agent-runner
8. agent-schedule-trip
9. agent-shops
10. agent-tools-general-broker
11. agents
12. job-board-ai-agent
13. waiter-ai-agent

### Inactive Functions (2)
14. housekeeping → `.archive/inactive-functions-20251203/`
15. video-performance-summary → `.archive/inactive-batch2-20251203/`

### Legacy Webhooks (20) - `.archive/wa-webhook-legacy-20251124/`
16-35. (20 legacy webhook functions - bulk archived)

**Total Archived**: 34 functions (already removed from codebase, not in production)

---

## ⏳ PHASE 5: TO DELETE (Week 7+) - 4 Functions

**Prerequisites**: 
- ✅ 100% traffic migrated to wa-webhook-unified
- ✅ 48 hours stable operation (error rate < 0.1%)
- ✅ Zero production webhook issues

**Functions to Delete**:
1. wa-webhook-ai-agents (after consolidation to unified)
2. wa-webhook-jobs (after consolidation to unified)
3. wa-webhook-marketplace (after consolidation to unified)
4. wa-webhook-property (after consolidation to unified)

**Execute**: `./scripts/phase5-delete-old-webhooks.sh`

---

## ⏳ PHASE 6: TO DELETE (Week 8+) - ~14 Functions

**MUST VERIFY BEFORE DELETION** - Check for cron jobs, RAG usage, active references

### Agent/AI Functions (2) - ⚠️ Verify RAG Pipeline
1. agent-doc-embed
2. agent-doc-search

### Admin/Campaign (4) - ⚠️ Check Cron Jobs
3. admin-subscriptions
4. campaign-dispatch
5. cart-reminder
6. order-pending-reminder

### Mock/Test Functions (3)
7. flow-exchange-mock
8. flow-exchange
9. simulator (may already be deleted)

### Legacy Tools (5) - ⚠️ Check Cron Usage
10. schedule-broadcast
11. schedule-email
12. schedule-sms
13. notify-buyers
14. qr_info (vs qr-resolve duplicate?)

**Verification Commands**:
```bash
# Check for cron jobs
supabase functions list --show-cron

# Check code references
grep -r "agent-doc-embed" src/ apps/ services/
grep -r "campaign-dispatch" src/ apps/ services/

# Check RAG pipeline
grep -r "retrieval-search\|agent-doc" supabase/functions/
```

**Execute**: `./scripts/phase6-final-cleanup.sh` (after verification)

---

## 🚨 NEVER DELETE (Production Protected)

**These 3 webhooks are LIVE in production:**
1. ✅ wa-webhook-mobility (v490) - Ride booking
2. ✅ wa-webhook-profile (v292) - User registration
3. ✅ wa-webhook-insurance (v340) - Insurance quotes

**Also Keep**:
- wa-webhook-core (utilities)
- wa-webhook-unified (consolidated replacement)
- wa-webhook (legacy fallback)
- wa-webhook-wallet (payments)

---

## 📊 SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| **Deleted (Phase 1)** | 3 | ✅ COMPLETE |
| **Archived Locally** | 34 | ✅ COMPLETE (not in production) |
| **To Delete (Phase 5)** | 4 | ⏳ Week 7+ (after traffic migration) |
| **To Delete (Phase 6)** | ~14 | ⏳ Week 8+ (verify first) |
| **Keep Forever** | ~53 | Final target |
| **Current Total** | 71 | (from 73) |

**Total Reduction**: 73 → 53 functions (-27%)

---

## 🔐 SAFETY RULES

1. ✅ **Production webhooks**: mobility, profile, insurance - NEVER delete
2. ✅ **Additive only**: Can add features to production, cannot remove
3. ✅ **Traffic routing**: Allows instant rollback
4. ✅ **48h stability**: Required before Phase 5 deletions
5. ✅ **Verification**: Required before Phase 6 deletions
6. ✅ **Reversible**: All deletions can be restored from git/archive

---

*Last Updated: December 3, 2025 - Phase 1 Complete*
