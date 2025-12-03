# Supabase Functions Consolidation - Quick Start

**Status**: Week 4 Complete ✅ | **Next**: Week 5 (Dec 11, 2025)

## 🚀 Run Week 5 (10% Traffic Migration)

```bash
# 1. Set project ref
export SUPABASE_PROJECT_REF="ozthtxtkxleudvbrxvkp"

# 2. Run Week 5
./scripts/consolidation/week5-integration.sh

# 3. Monitor
supabase functions logs wa-webhook-unified --tail 50
```

## 📊 Check Metrics

```sql
-- Success rate (target ≥99%)
SELECT * FROM webhook_routing_metrics;

-- Recent routing logs
SELECT domain, success, latency_ms, routed_at
FROM webhook_routing_logs
WHERE routed_at > NOW() - INTERVAL '1 hour'
ORDER BY routed_at DESC
LIMIT 50;
```

## ⚠️ Rollback (If Needed)

```sql
UPDATE webhook_routing_config 
SET traffic_percentage = 0, enabled = false;
```

## 📁 Key Files

- **Plan**: `SUPABASE_FUNCTIONS_CONSOLIDATION_PLAN_FINAL.md`
- **Summary**: `CONSOLIDATION_COMPLETE_SUMMARY.md`
- **Deletion List**: `FUNCTIONS_TO_DELETE_LIST.md`

## 📅 Timeline

| Week | Dates | Task | Script |
|------|-------|------|--------|
| **4** | Dec 4-10 | ✅ Setup | week4-deletions.sh |
| **5** | Dec 11-17 | 10% traffic | week5-integration.sh |
| **6** | Dec 18-24 | 50% traffic | week6-traffic-migration.sh |
| **7** | Dec 25-31 | 100% + archive | week7-deprecation.sh |
| **8** | Jan 1-7 | Delete old | week8-cleanup.sh |

## 🎯 Goal

**78 → 64 functions** (-18%)
- Delete: 22 archived (agents + inactive)
- Consolidate: 4 webhooks → wa-webhook-unified

## 🚨 Protected (Never Delete)

- wa-webhook-mobility
- wa-webhook-profile
- wa-webhook-insurance

---

**All documentation in**: `/SUPABASE_FUNCTIONS_CONSOLIDATION_PLAN_FINAL.md`
