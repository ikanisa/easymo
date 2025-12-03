# Supabase Functions Consolidation - Quick Reference
**Last Updated:** December 3, 2025 13:40 CET

---

## 📊 Current Status

| Metric | Value | Target |
|--------|-------|--------|
| **Deployed Functions** | 74 | 63 |
| **Week 4 Archived** | 5 | → Manual deletion pending |
| **Protected Webhooks** | 3 | Never delete |
| **Overall Progress** | 75% | Week 4 of 8 |

---

## 🎯 Quick Actions

### Check Current State
```bash
# Count deployed functions
supabase functions list | grep -c "ACTIVE"

# Verify protected webhooks
supabase functions list | grep -E "mobility|profile|insurance"

# List archived functions
ls -la supabase/functions/.archive/week4-deletions-20251203/
```

### Week 4: Manual Deletion (PENDING)
```bash
# Required: Owner/Admin role
# Option 1: Supabase Dashboard (easiest)
# Go to: https://supabase.com/dashboard/project/{project}/functions
# Delete manually: session-cleanup, search-alert-notifier, 
#                  reminder-service, search-indexer, insurance-admin-api

# Option 2: Authorized CLI
export SUPABASE_ACCESS_TOKEN="your-admin-token"
supabase functions delete session-cleanup
supabase functions delete search-alert-notifier
supabase functions delete reminder-service
supabase functions delete search-indexer
supabase functions delete insurance-admin-api
```

### Week 5-8: Automated Execution
```bash
# Week 5: Webhook integration (no traffic changes)
./scripts/consolidation-week5-integration.sh

# Week 6: Traffic migration (10% → 50%)
./scripts/consolidation-week6-traffic-migration.sh

# Week 7: Full cutover + deprecation (100%)
./scripts/consolidation-week7-deprecation.sh

# Week 8: Cleanup consolidation
./scripts/consolidation-week8-cleanup.sh
```

---

## 📁 Key Documents

| Document | Purpose |
|----------|---------|
| **WEEK_4_EXECUTION_STATUS.md** | Current status & next actions |
| **WEEK_4_MANUAL_DELETION_GUIDE.md** | Step-by-step deletion guide |
| **WEEK_4_DEEP_ANALYSIS_REPORT.md** | Complete analysis & verification |
| **WEEKS_5_8_DETAILED_IMPLEMENTATION_PLAN.md** | Next 4 weeks detailed plan |
| **SUPABASE_FUNCTIONS_CONSOLIDATION_MASTER_PLAN.md** | Complete 8-week overview |
| **CONSOLIDATION_IMPLEMENTATION_SUMMARY.md** | Executive summary |

---

## 🗂️ Functions Overview

### 🔒 Protected (NEVER DELETE) - 3 functions
- ✅ wa-webhook-mobility (v492, 80 commits/30d)
- ✅ wa-webhook-profile (v294, 42 commits/30d)
- ✅ wa-webhook-insurance (v342, 45 commits/30d)

### 🗑️ Week 4: Safe Deletions - 5 functions
- ⏳ session-cleanup → data-retention
- ⏳ search-alert-notifier → deprecated
- ⏳ reminder-service → no usage
- ⏳ search-indexer → retrieval-search
- ⏳ insurance-admin-api → admin-app

**Status:** Archived locally, awaiting manual deletion

### 🔄 Weeks 5-7: Webhook Consolidation - 4 functions
- wa-webhook-ai-agents → wa-webhook-unified
- wa-webhook-jobs → wa-webhook-unified
- wa-webhook-marketplace → wa-webhook-unified
- wa-webhook-property → wa-webhook-unified

**Timeline:** Gradual traffic migration (0% → 100%)

### 🔄 Week 8: Cleanup Consolidation - 2 functions
- cleanup-expired-intents → data-retention
- cleanup-mobility-intents → data-retention

**Timeline:** Merge cron jobs

---

## 📈 Progress Timeline

```
✅ Week 4: Deep Analysis & Archiving (75% complete)
   ├── [✓] Analyzed 74 functions
   ├── [✓] Identified 5 deletion targets
   ├── [✓] Verified 0 code references
   ├── [✓] Archived functions locally
   ├── [⏳] Manual deletion (pending Owner access)
   └── [⏳] 24h monitoring (post-deletion)

⏳ Week 5: Webhook Integration (0% complete)
   ├── [ ] Copy 4 webhook domains
   ├── [ ] Update router logic
   ├── [ ] Test each domain
   └── [ ] Deploy wa-webhook-unified

⏳ Week 6: Traffic Migration (0% complete)
   ├── [ ] Deploy traffic router
   ├── [ ] Route 10% traffic (4h monitor)
   ├── [ ] Route 25% traffic (4h monitor)
   ├── [ ] Route 35% traffic (6h monitor)
   └── [ ] Route 50% traffic (24h monitor)

⏳ Week 7: Full Cutover (0% complete)
   ├── [ ] Route 75% traffic (48h monitor)
   ├── [ ] Route 100% traffic (48h monitor)
   ├── [ ] Verify 48h stability
   └── [ ] Delete 4 legacy webhooks

⏳ Week 8: Cleanup Consolidation (0% complete)
   ├── [ ] Add cleanup jobs to data-retention
   ├── [ ] Update cron schedules
   └── [ ] Delete 2 cleanup functions
```

---

## 🚨 Troubleshooting

### Issue: 403 Forbidden on function delete
**Solution:** Requires Owner/Admin role. Use Supabase Dashboard or request authorized user.

### Issue: Function not found
**Solution:** Function may already be deleted. Check `supabase functions list`.

### Issue: Code references found
**Solution:** Review references, update code, redeploy, then delete function.

### Issue: High error rate after migration
**Solution:** Rollback traffic percentage via routing config table.

---

## 🔄 Rollback Commands

```bash
# Week 5-6: Reduce traffic routing
psql "postgresql://..." -c "SELECT update_routing_percentage(0.00);"

# Week 7: Restore deleted webhooks
cp -r .archive/week7-deprecated-webhooks/* supabase/functions/
supabase functions deploy wa-webhook-ai-agents
supabase functions deploy wa-webhook-jobs
supabase functions deploy wa-webhook-marketplace
supabase functions deploy wa-webhook-property

# Week 8: Restore cleanup functions
cp -r .archive/week8-cleanup-consolidated/* supabase/functions/
supabase functions deploy cleanup-expired-intents
supabase functions deploy cleanup-mobility-intents

# Restore from git tag
git checkout week4-pre-deletion
```

---

## 📊 Success Metrics

| Metric | Target | Verify |
|--------|--------|--------|
| Function count | 63 | `supabase functions list \| wc -l` |
| Error rate | < 0.1% | Supabase dashboard |
| P95 latency | < 2s | Webhook logs |
| Delivery rate | > 99.9% | WhatsApp Business API |
| Protected uptime | 100% | Monitor continuously |

---

## 🎯 Next Immediate Action

**MANUAL DELETION REQUIRED**

1. **Login to Supabase Dashboard** (Owner/Admin account)
2. **Navigate to Functions:** `https://supabase.com/dashboard/project/{project}/functions`
3. **Delete 5 functions:**
   - session-cleanup
   - search-alert-notifier
   - reminder-service
   - search-indexer
   - insurance-admin-api
4. **Verify:** `supabase functions list | wc -l` = 69
5. **Monitor:** 24 hours for errors
6. **Commit:** Archive completion
7. **Proceed:** Week 5 integration

---

**Status:** Awaiting manual deletion  
**Blocker:** Requires Owner/Admin role  
**Est. Time:** 5 min manual + 24h monitoring  
**Next Milestone:** Week 5 integration (after deletion)

