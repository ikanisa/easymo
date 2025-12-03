# Week 6: Quick Start Guide
**Start here for fast execution** ⚡

---

## 🚀 5-Step Execution

### 1. Get Database URL
```bash
# From Supabase Dashboard → Settings → Database → Connection String
export DATABASE_URL="postgresql://postgres.[PROJECT]:[PASSWORD]@[HOST]:6543/postgres"
```

### 2. Apply Migration
```bash
cd /Users/jeanbosco/workspace/easymo
./scripts/week6-apply-migration.sh
```
✅ Creates tables, views, and functions

### 3. Start 10% Rollout
```bash
./scripts/week6-start-rollout.sh
```
✅ Enables routing, sets 10% traffic

### 4. Monitor (Every 15 min × 4 hours)
```bash
./scripts/week6-quick-status.sh
```
✅ Check: Error < 0.1%, P95 < 2000ms

### 5. Scale to 25% (If Stable)
```bash
psql "$DATABASE_URL" -c "SELECT update_routing_percentage(25.00);"
```
✅ Continue monitoring for 4 more hours

---

## 📊 Success Metrics
- Error rate < 0.1%
- P95 latency < 2000ms
- Traffic: ~10% then ~25% to unified
- Protected webhooks: 100% uptime

---

## 🆘 Emergency Rollback
```bash
psql "$DATABASE_URL" -c "SELECT set_routing_enabled(false);"
```

---

## 📖 Full Documentation
- **WEEK_6_ROLLOUT_EXECUTION.md** - Complete guide
- **WEEK_6_DAY3_ROLLOUT.md** - Detailed procedures
- **scripts/week6-quick-status.sh** - Monitoring tool

---

**Ready? Start with Step 1!** 🚀
