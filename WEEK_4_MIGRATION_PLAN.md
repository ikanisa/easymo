# Week 4 Migration Plan - 10% Traffic Rollout

**Start Date:** Week 4  
**Target:** Route 10% of traffic to wa-webhook-unified  
**Status:** 🟡 PENDING - Ready to Execute

---

## 🎯 Objective

Gradually migrate 10% of WhatsApp webhook traffic from legacy functions to the new unified function while monitoring for issues.

---

## 📊 Pre-Migration Checklist

### Environment Verification
- [ ] Verify wa-webhook-unified is deployed and healthy
- [ ] Check Supabase function logs for any startup errors
- [ ] Verify all environment variables are set correctly
- [ ] Test webhook endpoint responds to GET requests
- [ ] Confirm database tables exist (ai_agent_configurations, webhook_metrics, etc.)

### Monitoring Setup
- [ ] Set up Supabase dashboard monitoring
- [ ] Create metrics tracking spreadsheet/dashboard
- [ ] Set up alert thresholds (error rate > 1%, latency > 2s)
- [ ] Document baseline metrics from old functions

### Baseline Metrics (Current State)
```
Record these BEFORE migration:

Old Functions (wa-webhook-ai-agents, jobs, marketplace, property):
- Total requests/day: _______
- Average response time: _______
- Error rate: _______
- Success rate: _______
- Peak traffic hours: _______
```

---

## 🚀 Migration Steps

### Step 1: Verify Unified Function Health

```bash
# Check function is deployed
supabase functions list | grep wa-webhook-unified

# View recent logs
supabase functions logs wa-webhook-unified --limit 50

# Test endpoint
curl -X GET https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-unified
# Expected: 405 Method Not Allowed (normal - webhook expects POST)
```

### Step 2: Configure Traffic Routing (10%)

**Option A: Meta Business Suite (Recommended)**

1. Go to Meta Business Suite → WhatsApp → Configuration
2. Find webhook settings
3. Current setup likely has single webhook URL
4. Need to implement one of these strategies:

**Strategy 1: Database-Driven Routing (Recommended)**
```sql
-- Create routing configuration table
CREATE TABLE IF NOT EXISTS webhook_routing (
  user_phone TEXT PRIMARY KEY,
  route_to TEXT NOT NULL CHECK (route_to IN ('legacy', 'unified')),
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assign 10% of users to unified
-- (Select users deterministically based on phone number hash)
INSERT INTO webhook_routing (user_phone, route_to)
SELECT 
  phone_number,
  CASE 
    WHEN (hashtext(phone_number)::bigint % 100) < 10 THEN 'unified'
    ELSE 'legacy'
  END as route_to
FROM (
  SELECT DISTINCT from_number as phone_number 
  FROM wa_events 
  WHERE created_at > NOW() - INTERVAL '30 days'
) active_users
ON CONFLICT (user_phone) DO NOTHING;

-- Verify distribution
SELECT route_to, COUNT(*) 
FROM webhook_routing 
GROUP BY route_to;
```

**Strategy 2: Load Balancer Routing**
- Configure your load balancer to route 10% traffic to new endpoint
- Use consistent hashing based on phone number

**Strategy 3: Application-Level Proxy**
```typescript
// Create a proxy function that routes based on user
// supabase/functions/wa-webhook-proxy/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const UNIFIED_URL = "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-unified";
const LEGACY_URLS = {
  'ai-agents': "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents",
  'jobs': "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-jobs",
  'marketplace': "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-marketplace",
  'property': "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-property",
};

serve(async (req) => {
  const body = await req.json();
  const phoneNumber = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  
  // Determine routing (10% to unified)
  const hash = hashCode(phoneNumber);
  const useUnified = (Math.abs(hash) % 100) < 10;
  
  // Route to appropriate endpoint
  const targetUrl = useUnified ? UNIFIED_URL : determineLegacyUrl(body);
  
  return fetch(targetUrl, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(body)
  });
});
```

### Step 3: Deploy Routing Logic

**If using database routing:**
```bash
# Run the SQL above to create routing table
psql $DATABASE_URL < routing_setup.sql

# Update legacy webhook functions to check routing table
# (This requires modifying each legacy function)
```

**If using proxy approach:**
```bash
# Deploy proxy function
supabase functions deploy wa-webhook-proxy --no-verify-jwt

# Update Meta webhook URL to proxy
# Old: https://[...]/wa-webhook-ai-agents
# New: https://[...]/wa-webhook-proxy
```

### Step 4: Monitor Initial Traffic

**First Hour Monitoring:**
```bash
# Watch unified function logs in real-time
supabase functions logs wa-webhook-unified --follow

# Check for errors
supabase functions logs wa-webhook-unified --limit 100 | grep -i error

# Monitor metrics
# Watch for:
# - Response times
# - Error rates
# - Agent coverage (all 8 agents being used?)
```

**Metrics to Track:**
```sql
-- Create monitoring queries

-- 1. Request volume by function
SELECT 
  function_name,
  COUNT(*) as request_count,
  AVG(duration_ms) as avg_duration,
  COUNT(*) FILTER (WHERE status_code >= 400) as error_count
FROM webhook_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY function_name;

-- 2. Agent usage in unified function
SELECT 
  agent_type,
  COUNT(*) as invocations,
  AVG(processing_time_ms) as avg_time,
  COUNT(*) FILTER (WHERE success = false) as failures
FROM ai_agent_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND function_name = 'wa-webhook-unified'
GROUP BY agent_type;

-- 3. Compare old vs new performance
SELECT 
  CASE 
    WHEN function_name = 'wa-webhook-unified' THEN 'NEW'
    ELSE 'OLD'
  END as version,
  COUNT(*) as requests,
  AVG(duration_ms) as avg_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_latency,
  COUNT(*) FILTER (WHERE status_code >= 400)::FLOAT / COUNT(*) * 100 as error_rate_pct
FROM webhook_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY version;
```

---

## 📈 Success Criteria

Traffic is successfully routed when:

- ✅ **10% ± 2%** of requests go to wa-webhook-unified
- ✅ **Error rate < 1%** on unified function
- ✅ **Avg response time < 2s** on unified function
- ✅ **All 8 agents** are being invoked correctly
- ✅ **No spike in DLQ messages**
- ✅ **User experience unchanged** (no complaints)

---

## 🚨 Rollback Triggers

Immediately rollback if:

- ❌ Error rate > 5%
- ❌ Response time > 5s for extended period
- ❌ Any agent completely failing
- ❌ Database connection issues
- ❌ Spike in user complaints
- ❌ DLQ filling up rapidly

---

## 🔄 Rollback Procedure

```bash
# 1. Immediate: Stop sending traffic to unified
# Update webhook URL or routing config back to legacy functions

# If using database routing:
UPDATE webhook_routing SET route_to = 'legacy' WHERE route_to = 'unified';

# If using proxy:
# Revert webhook URL in Meta Business Suite to direct legacy endpoints

# 2. Verify rollback
supabase functions logs wa-webhook-unified --limit 10
# Should see drastically reduced traffic

# 3. Investigate issues
supabase functions logs wa-webhook-unified --limit 200 | grep -i error

# 4. Fix and redeploy if needed
# Make fixes to wa-webhook-unified
supabase functions deploy wa-webhook-unified --no-verify-jwt

# 5. Resume migration when ready
# Gradually re-enable routing
```

---

## 📊 Daily Monitoring (Days 1-7)

### Day 1 (Hour-by-Hour)
- [ ] Hour 1: Monitor logs continuously
- [ ] Hour 2: Check metrics, verify 10% routing
- [ ] Hour 4: First metrics comparison
- [ ] Hour 8: Daily summary report
- [ ] Hour 24: Day 1 complete assessment

### Days 2-3 (Every 6 Hours)
- [ ] Morning check (error rate, latency)
- [ ] Afternoon check (agent coverage)
- [ ] Evening check (peak traffic handling)
- [ ] Night check (minimal traffic period)

### Days 4-7 (Daily)
- [ ] Daily metrics review
- [ ] Compare week-over-week
- [ ] User feedback monitoring
- [ ] Performance trending

---

## 📝 Metrics Collection Template

```
Date: ___________
Time: ___________
Duration: 1 hour

Unified Function (wa-webhook-unified):
- Total Requests: _______
- Avg Response Time: _______ ms
- P95 Response Time: _______ ms
- Error Count: _______
- Error Rate: _______ %
- Success Rate: _______ %

By Agent:
- Farmer: _______ requests
- Insurance: _______ requests
- Jobs: _______ requests
- Marketplace: _______ requests
- Property: _______ requests
- Rides: _______ requests
- Support: _______ requests
- Waiter: _______ requests

Legacy Functions:
- Total Requests: _______
- Avg Response Time: _______ ms
- Error Rate: _______ %

Traffic Split:
- Unified: _______ %
- Legacy: _______ %

Issues Observed:
_________________________________
_________________________________

Actions Taken:
_________________________________
_________________________________
```

---

## 🎯 Week 4 End Goals

By end of Week 4:

- ✅ 10% traffic successfully routed to unified function
- ✅ Metrics showing equal or better performance
- ✅ No increase in user complaints
- ✅ All 8 agents tested in production
- ✅ Monitoring dashboards established
- ✅ Team comfortable with rollback procedures
- ✅ Documentation updated with learnings

**If all green:** Proceed to Week 5 (50% traffic)  
**If issues:** Extend Week 4 until stable

---

## 📞 Communication Plan

### Stakeholders to Notify
- [ ] Engineering team
- [ ] Product team
- [ ] Customer support team
- [ ] Management

### Daily Standup Updates
```
Template:
- Migration status: X% traffic on unified
- Key metrics: error rate X%, avg latency Xms
- Issues: [list or "none"]
- Actions: [planned for today]
- Risk level: 🟢 Low / 🟡 Medium / 🔴 High
```

---

## 🛠️ Tools & Resources

### Monitoring URLs
- Supabase Dashboard: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions
- Logs: `supabase functions logs wa-webhook-unified`

### SQL Queries
- Saved in: `monitoring/week4_queries.sql`

### Documentation
- CONSOLIDATION_QUICK_REF.md
- SUPABASE_CONSOLIDATION_FINAL_REPORT.md

---

## ✅ Pre-Flight Checklist

Before starting Week 4 migration:

- [ ] wa-webhook-unified is deployed and healthy
- [ ] All 8 agents are working (tested manually)
- [ ] Database tables exist and have correct schema
- [ ] Monitoring queries are ready
- [ ] Rollback procedure is documented and tested
- [ ] Team is briefed on migration plan
- [ ] Customer support is aware of potential issues
- [ ] Routing mechanism is chosen and tested
- [ ] Baseline metrics are recorded

---

**Status:** 🟡 READY TO START  
**Next Action:** Choose routing strategy and execute Step 1

**Estimated Time:** 1 hour setup + 7 days monitoring  
**Risk Level:** 🟢 Low (only 10% traffic, easy rollback)

---

**Created:** December 3, 2025  
**Owner:** Engineering Team  
**Reviewers:** Tech Lead, DevOps
