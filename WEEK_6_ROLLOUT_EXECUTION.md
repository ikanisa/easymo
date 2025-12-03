# Week 6 Day 3: Rollout Execution Guide
**Date:** December 3, 2025 14:40 CET  
**Status:** 🚀 EXECUTING  
**Phase:** 10% → 25% Traffic Migration

---

## ⚠️ IMPORTANT: Database Connection Required

Before proceeding, you need to set your DATABASE_URL with actual credentials.

### Option 1: Environment Variable (Recommended)
```bash
# Get your database URL from Supabase Dashboard
# Settings → Database → Connection String → URI

export DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

### Option 2: Check Existing Connection
```bash
# If already set, verify it works
echo $DATABASE_URL

# Test connection
psql "$DATABASE_URL" -c "SELECT current_database();"
```

---

## 🚀 STEP-BY-STEP EXECUTION

### Step 1: Verify Prerequisites ✓

**Check function deployment:**
```bash
cd /Users/jeanbosco/workspace/easymo
supabase functions list | grep webhook-traffic-router
```
Expected: `webhook-traffic-router | ACTIVE | 1`

**Verify migration file exists:**
```bash
ls -lh supabase/migrations/20251203140600_webhook_traffic_routing.sql
```
Expected: ~7KB file exists

**Check scripts are executable:**
```bash
ls -lh scripts/week6-*.sh
```
Expected: All scripts have execute permissions

---

### Step 2: Set Database Connection

**Get your database URL:**
1. Go to Supabase Dashboard
2. Navigate to Settings → Database
3. Copy "Connection string" → "URI" format
4. Replace `[YOUR-PASSWORD]` with actual password

**Set environment variable:**
```bash
export DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Verify it's set
echo "Database configured: $(echo $DATABASE_URL | grep -o 'postgres\.[^:]*')"
```

---

### Step 3: Apply Database Migration

**Execute migration script:**
```bash
./scripts/week6-apply-migration.sh
```

**Expected output:**
```
╔════════════════════════════════════════════════╗
║  Week 6: Apply Database Migration             ║
╚════════════════════════════════════════════════╝

📊 Applying Migration: 20251203140600_webhook_traffic_routing.sql
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN
CREATE TABLE
COMMENT
INSERT 0 1
CREATE FUNCTION
...
COMMIT

✓ Migration applied successfully

🔍 Verifying Tables and Functions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tables created:
 webhook_routing_config
 webhook_routing_logs

Views created:
 webhook_routing_stats

Functions created:
 update_routing_percentage
 set_routing_enabled
 check_routing_health

📋 Initial Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 routing | status  | domains                     | notes
---------+---------+-----------------------------+------
 0%      | disabled| jobs, marketplace, property | Week 6 initial setup

✅ Migration Complete!
```

**Verify tables exist:**
```bash
psql "$DATABASE_URL" -c "\dt webhook_routing*"
psql "$DATABASE_URL" -c "\dv webhook_routing*"
psql "$DATABASE_URL" -c "\df *routing*"
```

---

### Step 4: Start 10% Rollout

**Execute rollout script:**
```bash
./scripts/week6-start-rollout.sh
```

**What it does:**
1. Enables routing (`enabled=true`)
2. Sets percentage to 10.00
3. Displays current configuration
4. Shows monitoring commands

**Expected output:**
```
╔════════════════════════════════════════════════╗
║  Week 6: Start 10% Traffic Rollout            ║
╚════════════════════════════════════════════════╝

⚠️  WARNING: This will start routing webhook traffic

This will:
  • Enable routing (set enabled=true)
  • Route 10% of traffic to wa-webhook-unified
  • Domains: jobs, marketplace, property
  • Protected: mobility, profile, insurance (never routed)

Press Enter to continue or Ctrl+C to cancel...

🚀 Step 1: Enable Routing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTICE: Routing enabled set to: true

📈 Step 2: Set 10% Traffic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTICE: Routing percentage updated to 10%. Enabled: true

✅ 10% Traffic Rollout Started!

Status:
  • Routing: ENABLED ✓
  • Percentage: 10%
  • Target: wa-webhook-unified
  • Domains: jobs, marketplace, property
```

---

### Step 5: Monitor for 4 Hours (09:00 - 13:00)

**Set up monitoring:**
```bash
# Create monitoring loop (every 15 minutes)
watch -n 900 'psql "$DATABASE_URL" -c "SELECT * FROM webhook_routing_stats;" && echo "" && psql "$DATABASE_URL" -c "SELECT * FROM check_routing_health();"'
```

**Or manual checks every 15 minutes:**

**09:00** - Initial check:
```sql
-- Real-time stats (last hour)
SELECT * FROM webhook_routing_stats ORDER BY domain, routed_to;

-- Health status
SELECT * FROM check_routing_health();

-- Traffic distribution
SELECT 
    domain,
    routed_to,
    COUNT(*) as requests,
    (COUNT(*)::float / SUM(COUNT(*)) OVER (PARTITION BY domain) * 100)::int as pct
FROM webhook_routing_logs
WHERE created_at > now() - interval '1 hour'
GROUP BY domain, routed_to;
```

**Expected metrics:**
```
domain      | routed_to | requests | avg_ms | p95_ms | error_pct
------------+-----------+----------+--------+--------+-----------
jobs        | unified   | ~50      | 800    | 1800   | 0.00
jobs        | legacy    | ~450     | 750    | 1700   | 0.00
marketplace | unified   | ~30      | 850    | 1900   | 0.00
marketplace | legacy    | ~270     | 770    | 1750   | 0.00
property    | unified   | ~20      | 820    | 1850   | 0.00
property    | legacy    | ~180     | 740    | 1700   | 0.00
```

**Alert thresholds:**
- ⚠️  **Warning:** Error rate > 0.1% OR P95 > 2000ms → Investigate
- 🚨 **Critical:** Error rate > 0.5% OR P95 > 3000ms → Rollback immediately

**Rollback if needed:**
```sql
-- Emergency rollback
SELECT set_routing_enabled(false, 'Emergency rollback - high error rate');

-- Or gradual
SELECT update_routing_percentage(5.00, 'Stepping back');
```

**13:00** - 4 hour evaluation:
```sql
-- Summary of last 4 hours
SELECT 
    routed_to,
    COUNT(*) as total_requests,
    ROUND(AVG(response_time_ms)::numeric, 2) as avg_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 2) as p95_ms,
    ROUND((SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::float / COUNT(*) * 100)::numeric, 4) as error_pct
FROM webhook_routing_logs
WHERE created_at > now() - interval '4 hours'
GROUP BY routed_to;
```

**Decision criteria:**
- ✅ **Proceed to 25%:** Error < 0.1%, P95 < 2000ms, no issues
- ⏸️ **Hold at 10%:** Borderline metrics, need more time
- 🔙 **Rollback:** Errors or latency above thresholds

---

### Step 6: Scale to 25% (13:30 - if 10% stable)

**Prerequisites verified:**
- [x] 10% stable for 4 hours
- [x] Error rate < 0.1%
- [x] P95 latency < 2000ms
- [x] No customer complaints

**Scale to 25%:**
```sql
-- Verify health first
SELECT * FROM check_routing_health();

-- Scale up
SELECT update_routing_percentage(25.00, 'Scaling to 25% after successful 10% test');

-- Verify change
SELECT percentage, enabled, domains FROM webhook_routing_config ORDER BY created_at DESC LIMIT 1;
```

---

### Step 7: Monitor 25% for 4 Hours (14:00 - 18:00)

**Same monitoring as 10%, watching for:**
- Error rate stays < 0.1%
- P95 latency stays < 2000ms
- ~25% traffic going to unified
- ~75% traffic going to legacy

**Expected distribution at 25%:**
```
domain      | routed_to | pct
------------+-----------+-----
jobs        | unified   | 25%
jobs        | legacy    | 75%
marketplace | unified   | 25%
marketplace | legacy    | 75%
property    | unified   | 25%
property    | legacy    | 75%
```

**18:00** - Day 3 complete evaluation:
```sql
-- Full day summary
SELECT 
    domain,
    routed_to,
    COUNT(*) as total_requests,
    ROUND(AVG(response_time_ms)::numeric, 0) || 'ms' as avg,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::numeric, 0) || 'ms' as p95,
    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
    ROUND((SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::float / COUNT(*) * 100)::numeric, 4) || '%' as error_rate
FROM webhook_routing_logs
WHERE created_at > now() - interval '8 hours'
GROUP BY domain, routed_to
ORDER BY domain, routed_to;
```

---

## ✅ Success Criteria - Day 3 Complete

- [ ] 10% rollout: Stable for 4 hours (error < 0.1%, P95 < 2s)
- [ ] 25% rollout: Stable for 4 hours (error < 0.1%, P95 < 2s)
- [ ] Traffic distribution: ~25% unified, ~75% legacy
- [ ] Protected webhooks: 100% uptime (never routed)
- [ ] Customer impact: Zero
- [ ] Monitoring data: Complete and analyzed
- [ ] Documentation: Updated with actual metrics

**If all criteria met:** ✅ **Week 6 Day 3 COMPLETE**

**Next:** Leave at 25% overnight, proceed to Day 4 (35%) tomorrow morning

---

## 📊 Actual Results Template

Fill this in as you execute:

### 10% Rollout (4 hours)
```
Start time: ___:___
End time: ___:___
Requests (unified): _____
Requests (legacy): _____
Error rate (unified): _____% (target < 0.1%)
Error rate (legacy): _____% (target < 0.1%)
P95 latency (unified): _____ms (target < 2000ms)
P95 latency (legacy): _____ms (target < 2000ms)
Decision: [✅ Proceed | ⏸️ Hold | 🔙 Rollback]
```

### 25% Rollout (4 hours)
```
Start time: ___:___
End time: ___:___
Requests (unified): _____
Requests (legacy): _____
Error rate (unified): _____% (target < 0.1%)
Error rate (legacy): _____% (target < 0.1%)
P95 latency (unified): _____ms (target < 2000ms)
P95 latency (legacy): _____ms (target < 2000ms)
Decision: [✅ Success | ⏸️ Monitor | 🔙 Rollback]
```

---

## 🆘 Troubleshooting

**Issue: Migration fails**
```bash
# Check if tables already exist
psql "$DATABASE_URL" -c "\dt webhook_routing*"

# If yes, skip migration or drop and recreate
# Drop (CAUTION - loses data):
psql "$DATABASE_URL" -c "DROP VIEW IF EXISTS webhook_routing_stats CASCADE; DROP TABLE IF EXISTS webhook_routing_logs CASCADE; DROP TABLE IF EXISTS webhook_routing_config CASCADE;"
```

**Issue: No traffic being routed**
```sql
-- Check configuration
SELECT * FROM webhook_routing_config ORDER BY created_at DESC LIMIT 1;

-- Should show: enabled=true, percentage=10.00 or 25.00

-- Check if traffic router is receiving requests
SELECT COUNT(*) FROM webhook_routing_logs WHERE created_at > now() - interval '15 minutes';
-- Should show growing count
```

**Issue: High error rate**
```sql
-- Investigate errors
SELECT 
    domain,
    routed_to,
    error_message,
    COUNT(*) as count
FROM webhook_routing_logs
WHERE status = 'error' AND created_at > now() - interval '1 hour'
GROUP BY domain, routed_to, error_message
ORDER BY count DESC
LIMIT 10;

-- Immediate rollback if critical
SELECT set_routing_enabled(false, 'High error rate detected');
```

**Issue: DATABASE_URL not working**
```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT current_database();"

# If fails, verify:
# 1. URL format is correct
# 2. Password has no special characters (or is URL-encoded)
# 3. Project is not paused
# 4. IP is allowed (if IP restrictions enabled)
```

---

**Status:** Ready for execution  
**Prerequisites:** DATABASE_URL must be set  
**Duration:** ~8 hours total  
**Next:** Execute steps sequentially

