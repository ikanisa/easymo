# Week 6 Day 3: Traffic Rollout Execution
**Date:** December 3, 2025 14:30 CET  
**Phase:** 10% → 25% Traffic Migration  
**Status:** 🚀 Ready to Execute

---

## 🎯 Objective

Start routing 10% of webhook traffic (jobs, marketplace, property domains) to `wa-webhook-unified`, monitor for 4 hours, then scale to 25%.

**Success Criteria:**
- Error rate < 0.1%
- P95 latency < 2s
- Traffic distribution: ~10% unified, ~90% legacy
- Protected webhooks: 100% uptime (mobility, profile, insurance)

---

## 📋 Pre-Rollout Checklist

Before starting, verify:

### 1. Infrastructure Deployed ✓
```bash
# Check traffic router function
supabase functions list | grep webhook-traffic-router
# Should show: webhook-traffic-router | ACTIVE

# Verify status
✅ Function: webhook-traffic-router deployed
✅ Version: 1
✅ Status: ACTIVE
```

### 2. Database Migration Applied
```bash
# Apply if not already done
./scripts/week6-apply-migration.sh

# Or manually:
psql "$DATABASE_URL" < supabase/migrations/20251203140600_webhook_traffic_routing.sql

# Verify tables exist
psql "$DATABASE_URL" -c "\dt webhook_routing*"
```

### 3. Initial Configuration Check
```sql
-- Should show: percentage=0.00, enabled=false
SELECT * FROM webhook_routing_config ORDER BY created_at DESC LIMIT 1;
```

---

## 🚀 Execution Plan

### Phase 1: Enable 10% Traffic (Morning)

**Step 1: Start Rollout**
```bash
# Execute automated script
./scripts/week6-start-rollout.sh

# This will:
# 1. Enable routing (enabled=true)
# 2. Set percentage to 10.00
# 3. Display monitoring commands
```

**Manual Alternative:**
```sql
-- Enable routing
SELECT set_routing_enabled(true, 'Week 6 Day 3: Starting 10% rollout');

-- Set 10% traffic
SELECT update_routing_percentage(10.00, 'Initial 10% rollout - monitoring for 4 hours');

-- Verify
SELECT percentage, enabled, domains FROM webhook_routing_config ORDER BY created_at DESC LIMIT 1;
```

**Step 2: Continuous Monitoring (4 hours)**

Monitor every 15 minutes:
```sql
-- Real-time stats (last hour)
SELECT 
    domain,
    routed_to,
    request_count,
    ROUND(avg_response_ms::numeric, 2) as avg_ms,
    ROUND(p95_ms::numeric, 2) as p95_ms,
    error_count,
    ROUND(error_rate_pct::numeric, 4) as error_pct
FROM webhook_routing_stats 
ORDER BY domain, routed_to;

-- Health check
SELECT * FROM check_routing_health();

-- Traffic distribution
SELECT 
    domain,
    routed_to,
    COUNT(*) as requests,
    (COUNT(*)::float / SUM(COUNT(*)) OVER (PARTITION BY domain) * 100)::int as pct
FROM webhook_routing_logs
WHERE created_at > now() - interval '1 hour'
GROUP BY domain, routed_to
ORDER BY domain, routed_to;
```

**Alert Thresholds:**
- ⚠️  Error rate > 0.1% → Investigate immediately
- ⚠️  P95 latency > 2000ms → Investigate immediately
- 🚨 Error rate > 0.5% → Rollback to 0%
- 🚨 P95 latency > 3000ms → Rollback to 0%

### Phase 2: Scale to 25% (Afternoon)

**Prerequisites:**
- ✅ 10% stable for 4 hours
- ✅ Error rate < 0.1%
- ✅ P95 latency < 2s
- ✅ No customer complaints

**Step 3: Scale to 25%**
```sql
-- Verify 10% was healthy
SELECT * FROM check_routing_health();

-- Scale to 25%
SELECT update_routing_percentage(25.00, 'Scaling to 25% after successful 10% test');

-- Verify
SELECT percentage, enabled FROM webhook_routing_config ORDER BY created_at DESC LIMIT 1;
```

**Step 4: Monitor 25% (4 hours)**

Same monitoring as 10%, verify:
- Error rate stays < 0.1%
- P95 latency stays < 2s
- ~25% traffic going to unified
- ~75% traffic going to legacy

---

## 📊 Monitoring Dashboard

### Quick Status Check
```sql
-- One-line status
SELECT 
    percentage || '% → unified' as routing,
    enabled::text as status,
    (SELECT COUNT(*) FROM webhook_routing_logs WHERE created_at > now() - interval '1 hour') as requests_1h,
    (SELECT ROUND(AVG(error_rate_pct)::numeric, 2) FROM webhook_routing_stats) as avg_error_pct
FROM webhook_routing_config 
ORDER BY created_at DESC 
LIMIT 1;
```

### Detailed Metrics
```sql
-- Performance by domain and destination
SELECT 
    domain,
    routed_to,
    request_count,
    ROUND(p50_ms::numeric, 0) || 'ms' as p50,
    ROUND(p95_ms::numeric, 0) || 'ms' as p95,
    ROUND(p99_ms::numeric, 0) || 'ms' as p99,
    error_count,
    CASE 
        WHEN error_rate_pct < 0.1 THEN '✅ ' || error_rate_pct::text || '%'
        WHEN error_rate_pct < 0.5 THEN '⚠️  ' || error_rate_pct::text || '%'
        ELSE '🚨 ' || error_rate_pct::text || '%'
    END as error_status
FROM webhook_routing_stats
ORDER BY domain, routed_to;
```

### Error Analysis
```sql
-- Recent errors (last hour)
SELECT 
    domain,
    routed_to,
    error_message,
    COUNT(*) as occurrences,
    MAX(created_at) as last_seen
FROM webhook_routing_logs
WHERE status = 'error' 
    AND created_at > now() - interval '1 hour'
GROUP BY domain, routed_to, error_message
ORDER BY occurrences DESC
LIMIT 10;
```

### Traffic Comparison
```sql
-- Unified vs Legacy performance
WITH stats AS (
    SELECT 
        routed_to,
        COUNT(*) as total_requests,
        AVG(response_time_ms) as avg_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as error_pct
    FROM webhook_routing_logs
    WHERE created_at > now() - interval '1 hour'
    GROUP BY routed_to
)
SELECT 
    routed_to,
    total_requests,
    ROUND(avg_ms::numeric, 2) as avg_ms,
    ROUND(p95::numeric, 2) as p95_ms,
    ROUND(error_pct::numeric, 4) as error_rate
FROM stats
ORDER BY routed_to;
```

---

## 🔄 Rollback Procedures

### Emergency Rollback (Immediate)
```sql
-- Disable routing completely
SELECT set_routing_enabled(false, 'Emergency rollback - high error rate');

-- Verify
SELECT enabled FROM webhook_routing_config ORDER BY created_at DESC LIMIT 1;
-- Should show: false
```

### Gradual Rollback
```sql
-- Step back from 25% to 10%
SELECT update_routing_percentage(10.00, 'Stepping back due to elevated errors');

-- Step back from 10% to 5%
SELECT update_routing_percentage(5.00, 'Further rollback');

-- Disable completely
SELECT set_routing_enabled(false, 'Full rollback');
```

### Rollback Triggers

**Immediate Rollback If:**
- Error rate > 0.5%
- P95 latency > 3000ms
- Protected webhooks affected
- Customer complaints spike

**Gradual Rollback If:**
- Error rate between 0.1% - 0.5%
- P95 latency between 2000ms - 3000ms
- Inconsistent behavior

---

## ✅ Success Checkpoints

### After 10% (4 hours)
- [ ] Error rate < 0.1% ✓
- [ ] P95 latency < 2000ms ✓
- [ ] ~10% traffic to unified
- [ ] No customer impact
- [ ] Protected webhooks 100% uptime

### After 25% (4 hours)
- [ ] Error rate < 0.1% ✓
- [ ] P95 latency < 2000ms ✓
- [ ] ~25% traffic to unified
- [ ] No degradation vs 10%
- [ ] Ready for Day 4 (35%)

---

## 📈 Expected Results

### Traffic Distribution at 10%
```
Domain: jobs
├── unified: ~10% (50-60 requests/hour)
└── legacy: ~90% (450-540 requests/hour)

Domain: marketplace
├── unified: ~10% (30-40 requests/hour)
└── legacy: ~90% (270-360 requests/hour)

Domain: property
├── unified: ~10% (20-30 requests/hour)
└── legacy: ~90% (180-270 requests/hour)
```

### Performance Targets
```
Response Time:
├── Unified: avg ~800ms, P95 < 2000ms
└── Legacy: avg ~750ms, P95 < 1800ms

Error Rate:
├── Unified: < 0.1%
└── Legacy: < 0.1%
```

---

## 📞 Communication

### Stakeholder Updates

**Start of Rollout:**
```
Subject: Week 6 Traffic Rollout Started - 10%

We've started routing 10% of webhook traffic to the unified system.
- Domains: jobs, marketplace, property
- Protected: mobility, profile, insurance (no changes)
- Monitoring: Continuous for 4 hours
- Expected impact: None (seamless transition)

Will update after 4 hours with results.
```

**After 10% Success:**
```
Subject: Week 6 - 10% Rollout Successful, Scaling to 25%

10% rollout completed successfully:
- Error rate: X% (target < 0.1%)
- P95 latency: Xms (target < 2000ms)
- Zero customer impact

Proceeding with 25% rollout.
```

---

## 🎯 Day 3 Timeline

```
09:00 - Start 10% rollout
09:15 - First monitoring check
09:30 - Second check
10:00 - Third check
... (every 15 min)
13:00 - 4 hours complete, evaluate
13:30 - Scale to 25% (if successful)
14:00 - Monitor 25%
... (every 15 min)
18:00 - Day 3 complete
```

---

## 📖 Next Steps

### After Day 3 (25% stable)

**Day 4: Scale to 35%**
```bash
# Monitor 25% for overnight stability
# Next morning, scale to 35%
psql "$DATABASE_URL" -c "SELECT update_routing_percentage(35.00, 'Day 4: Scaling to 35%');"

# Monitor for 6 hours
```

**Day 5: Scale to 50% (Week 6 Target)**
```bash
# After 35% is stable, scale to 50%
psql "$DATABASE_URL" -c "SELECT update_routing_percentage(50.00, 'Day 5: Week 6 target reached');"

# Monitor for 24 hours before Week 7
```

---

**Status:** Ready to execute  
**Risk:** MEDIUM (first traffic routing)  
**Rollback:** Instant (single SQL command)  
**Duration:** 8 hours (4h @ 10%, 4h @ 25%)

