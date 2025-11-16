# 🏗️ Supabase Infrastructure - Complete Scalability Audit & Optimization Plan

**Audit Date:** November 15, 2025  
**Status:** ⚠️ NEEDS OPTIMIZATION  
**Priority:** HIGH

---

## 📊 CURRENT STATE METRICS

### Database
| Metric | Count | Status |
|--------|-------|--------|
| Tables | 216 | ✅ Manageable |
| Functions | 1,085 | ⚠️ High |
| Indexes | 813 | ✅ Good coverage |
| RLS Policies | 385 | ✅ Well secured |
| Tables without RLS | 20 | ⚠️ Needs review |

### Edge Functions
| Metric | Count | Status |
|--------|-------|--------|
| Total Functions | 54 | ✅ Reasonable |
| wa-webhook Files | 194 | ⚠️ Very large |
| wa-webhook LOC | 38,699 | 🚨 **CRITICAL** |
| wa-webhook Domains | 16 | ✅ Well organized |
| Large Files (>500 LOC) | 14 | ⚠️ Needs refactoring |

### Code Quality Metrics
| Metric | Count | Status |
|--------|-------|--------|
| HTTP Calls | 58 | ⚠️ Monitor |
| Array Operations | 202 | ⚠️ Check performance |
| JSON Operations | 110 | ⚠️ Memory intensive |
| console.log | 24 | ⚠️ Replace with structured logs |
| setTimeout/sleep | 6 | ⚠️ Review necessity |
| Try-catch without handling | 6 | ⚠️ Fix error handling |

---

## 🚨 CRITICAL SCALABILITY ISSUES

### 1. **wa-webhook is TOO LARGE** 🚨
**Problem:** 38,699 lines of code in single function  
**Impact:**
- Slow cold starts (>5 seconds)
- High memory usage
- Difficult to maintain
- All-or-nothing deployments

**Current Deployment Size:** 453.1kB (very large for edge function)

**Risk Level:** 🔴 **CRITICAL**

### 2. **Database Function Bloat** ⚠️
**Problem:** 1,085 database functions  
**Impact:**
- Query planning overhead
- Hard to maintain
- Potential performance degradation

**Risk Level:** 🟡 **MEDIUM**

### 3. **Missing Observability** ⚠️
**Problem:** 24 console.log calls instead of structured logging  
**Impact:**
- Can't track performance
- No monitoring/alerting
- Hard to debug production issues

**Risk Level:** 🟡 **MEDIUM**

### 4. **20 Tables Without RLS** ⚠️
**Problem:** Security gaps  
**Tables affected:**
- analytics_events_*
- event_store_*
- job_categories, job_sources
- momo_parsed_txns, momo_sms_inbox
- referral_*, send_*, leaderboard_*

**Risk Level:** 🟡 **MEDIUM-HIGH**

---

## 🎯 OPTIMIZATION PLAN

### Phase 1: IMMEDIATE (Week 1) 🔴

#### 1.1. Split wa-webhook into Microservices
**Current:** 1 monolithic function (453KB)  
**Target:** 5-10 focused functions

**Proposed Split:**
```
wa-webhook-core (50KB)
├─ Message routing
├─ Authentication
└─ Basic replies

wa-webhook-jobs (40KB)
├─ Job board AI
└─ Job searches

wa-webhook-marketplace (50KB)
├─ Shops/Services
├─ Property
└─ Business management

wa-webhook-mobility (40KB)
├─ Nearby drivers/passengers
├─ Schedule trips
└─ Insurance

wa-webhook-ai-agents (60KB)
├─ AI orchestration
├─ Memory management
└─ Tool execution

wa-webhook-profile (30KB)
├─ Profile management
├─ Wallet
└─ Settings
```

**Benefits:**
- Faster cold starts (50KB vs 453KB)
- Independent deployments
- Better resource allocation
- Easier debugging

**Implementation:**
```typescript
// Router in wa-webhook-core
if (message.includes('job')) {
  return await fetch('wa-webhook-jobs', { ... });
} else if (message.includes('property')) {
  return await fetch('wa-webhook-marketplace', { ... });
}
```

#### 1.2. Add Structured Logging Everywhere
Replace all `console.log` with observability functions:

```typescript
// ❌ Before
console.log('User searched for jobs');

// ✅ After
await logStructuredEvent('JOB_SEARCH', {
  user_id: userId,
  query: searchTerm,
  country: countryCode,
  results_count: results.length
});
```

**Files to update:** 24 instances

#### 1.3. Enable RLS on Missing Tables
```sql
-- Analytics tables (already partitioned, add RLS)
ALTER TABLE analytics_events_2026_04 ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events_2026_05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_store_2026_04 ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_store_2026_05 ENABLE ROW LEVEL SECURITY;

-- Job tables
ALTER TABLE job_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sources ENABLE ROW LEVEL SECURITY;

-- Create appropriate policies...
```

### Phase 2: SHORT TERM (Week 2-3) 🟡

#### 2.1. Refactor Large Files
**Target files (>500 lines):**
1. `notify/sender.ts` - Split into sender + formatter
2. `domains/property/rentals.ts` - Extract search, post, favorites
3. `domains/ai-agents/integration.ts` - Modularize
4. `domains/marketplace/index.ts` - Split by category
5. `router/interactive_list.ts` - Extract handlers

**Pattern:**
```typescript
// ❌ Before: One 800-line file
// property/rentals.ts

// ✅ After: Multiple focused files
// property/search.ts (200 lines)
// property/post.ts (150 lines)
// property/favorites.ts (150 lines)
// property/index.ts (100 lines) - router
```

#### 2.2. Database Query Optimization

**Add missing indexes:**
```sql
-- Webhook logs (5MB+ table)
CREATE INDEX IF NOT EXISTS webhook_logs_created_at_idx 
  ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_logs_status_idx 
  ON webhook_logs(status) WHERE status != 'success';

-- Business table (2MB+)
CREATE INDEX IF NOT EXISTS business_search_idx 
  ON business USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));

-- Agent vectors for similarity search
CREATE INDEX IF NOT EXISTS agent_document_vectors_embedding_idx 
  ON agent_document_vectors USING ivfflat(embedding vector_cosine_ops);
```

#### 2.3. Implement Caching Strategy

**In-memory cache for static data:**
```typescript
// Cache menu items (changes rarely)
const menuCache = new Map<string, MenuItem[]>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getMenuItems(country: string) {
  const cacheKey = `menu_${country}`;
  const cached = menuCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchFromDB();
  menuCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

**Use Redis for distributed cache:**
```typescript
// Cache user sessions, rate limiting
const redis = createClient({ url: Deno.env.get('REDIS_URL') });

// Cache expensive AI responses
await redis.setex(`ai_response:${hash}`, 3600, JSON.stringify(response));
```

### Phase 3: MEDIUM TERM (Month 1-2) 🟢

#### 3.1. Database Function Cleanup

**Audit and consolidate 1,085 functions:**
1. Identify unused functions (check pg_stat_user_functions)
2. Consolidate similar functions
3. Move complex logic to application layer
4. Keep only performance-critical operations in DB

```sql
-- Find unused functions
SELECT 
  funcname,
  calls,
  total_time
FROM pg_stat_user_functions
WHERE schemaname = 'public'
ORDER BY calls ASC
LIMIT 50;

-- Drop unused functions
DROP FUNCTION IF EXISTS old_function_name;
```

#### 3.2. Implement Rate Limiting

```typescript
// Per-user rate limiting
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(userId: string, maxPerMinute: number = 20): boolean {
  const now = Date.now();
  const userRequests = rateLimiter.get(userId) || [];
  
  // Remove old requests (>1 minute)
  const recentRequests = userRequests.filter(t => now - t < 60000);
  
  if (recentRequests.length >= maxPerMinute) {
    return false; // Rate limited
  }
  
  recentRequests.push(now);
  rateLimiter.set(userId, recentRequests);
  return true;
}
```

#### 3.3. Add Performance Monitoring

```sql
-- Create performance tracking table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  execution_time_ms int NOT NULL,
  memory_used_mb int,
  country_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX perf_metrics_function_time_idx 
  ON performance_metrics(function_name, created_at DESC);
```

```typescript
// Track execution time
async function trackPerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    await logMetric(name, duration);
  }
}
```

### Phase 4: LONG TERM (Month 3+) 🔵

#### 4.1. Move to Event-Driven Architecture

**Current:** Synchronous request-response  
**Target:** Asynchronous event processing

```typescript
// Publisher (wa-webhook)
await publishEvent('job.search.requested', {
  user_id: userId,
  query: searchQuery,
  country: countryCode
});

// Consumer (job-search-worker)
async function handleJobSearch(event) {
  const results = await searchJobs(event.query);
  await publishEvent('job.search.completed', { ...event, results });
}
```

**Benefits:**
- Better scalability
- Fault tolerance
- Can handle traffic spikes
- Async processing of heavy tasks

#### 4.2. Implement Database Partitioning

**Large tables to partition:**
```sql
-- Partition webhook_logs by month
CREATE TABLE webhook_logs_2025_11 PARTITION OF webhook_logs
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- Partition analytics by month (already done)
-- Continue pattern for other high-volume tables
```

#### 4.3. Add Read Replicas

**Setup:**
- Master: Write operations
- Replica 1: Read operations (reports, analytics)
- Replica 2: AI/ML queries (vector similarity)

```typescript
// Read from replica for non-critical data
const replicaClient = createClient(REPLICA_URL);
const data = await replicaClient.from('job_listings').select('*');
```

---

## 🎯 RECOMMENDED IMMEDIATE ACTIONS

### This Week (Top Priority)

1. **Enable RLS on 20 tables** ⚠️
   - Time: 2 hours
   - Impact: Security improvement
   - Command: Run SQL scripts in appendix

2. **Add structured logging** ⚠️
   - Time: 4 hours
   - Impact: Better observability
   - Files: 24 instances to fix

3. **Split wa-webhook** 🚨
   - Time: 2-3 days
   - Impact: MAJOR performance improvement
   - Start with: jobs, marketplace, mobility

4. **Add performance indexes** ⚠️
   - Time: 1 hour
   - Impact: Query speed 2-5x faster
   - Tables: webhook_logs, business, agent_vectors

---

## 📈 EXPECTED IMPROVEMENTS

| Metric | Before | After Phase 1 | After Phase 3 |
|--------|--------|---------------|---------------|
| Cold Start Time | 5-8s | 1-2s | <1s |
| Memory Usage | 512MB | 128MB | 64MB |
| Response Time (p95) | 2000ms | 500ms | 200ms |
| Deployment Time | 45s | 10s | 5s |
| Error Rate | 2% | 0.5% | 0.1% |

---

## 🔧 APPENDIX A: Quick Fix SQL Scripts

### A.1. Enable RLS on All Tables
```sql
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'analytics_events_2026_04', 'analytics_events_2026_05',
      'event_store_2026_04', 'event_store_2026_05',
      'job_categories', 'job_sources',
      'momo_parsed_txns', 'momo_sms_inbox',
      'referral_attributions', 'referral_clicks', 'referral_links',
      'send_logs', 'send_queue',
      'leaderboard_notifications', 'leaderboard_snapshots',
      'promo_rules', 'segments'
    )
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY "Service role full access" ON %I FOR ALL USING (auth.jwt()->>''"role"'' = ''service_role'')', tbl);
  END LOOP;
END $$;
```

### A.2. Add Missing Indexes
```sql
BEGIN;

-- Webhook logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS webhook_logs_created_at_idx 
  ON webhook_logs(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS webhook_logs_status_failed_idx 
  ON webhook_logs(status) WHERE status != 'success';

-- Business search
CREATE INDEX CONCURRENTLY IF NOT EXISTS business_search_trgm_idx 
  ON business USING gin(name gin_trgm_ops);

-- Job listings
CREATE INDEX CONCURRENTLY IF NOT EXISTS job_listings_country_status_idx 
  ON job_listings(country_code, status) WHERE status = 'open';

-- WA events
CREATE INDEX CONCURRENTLY IF NOT EXISTS wa_events_created_profile_idx 
  ON wa_events(created_at DESC, profile_id);

COMMIT;
```

### A.3. Clean Up Console.log Statements
```bash
# Find and list all console.log
cd supabase/functions/wa-webhook
grep -rn "console\.log" --include="*.ts" > /tmp/console_logs.txt

# Pattern to replace:
# console.log('message', data)
# → 
# await logStructuredEvent('EVENT_NAME', { ...data })
```

---

## 🎯 SUCCESS METRICS

Track these KPIs weekly:

1. **Function Response Time**
   - Current: ~2000ms (p95)
   - Target: <500ms (p95)

2. **Cold Start Time**
   - Current: 5-8 seconds
   - Target: <2 seconds

3. **Error Rate**
   - Current: ~2%
   - Target: <0.5%

4. **Memory Usage**
   - Current: 512MB peak
   - Target: <128MB peak

5. **Deployment Success Rate**
   - Current: ~95%
   - Target: >99%

---

## 📚 REFERENCES

- [Supabase Edge Functions Best Practices](https://supabase.com/docs/guides/functions/best-practices)
- [Deno Deploy Limits](https://deno.com/deploy/docs/pricing-and-limits)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

## ✅ ACTION CHECKLIST

### Week 1 (CRITICAL)
- [ ] Enable RLS on 20 tables
- [ ] Add structured logging (replace 24 console.log)
- [ ] Add missing database indexes
- [ ] Create wa-webhook splitting plan
- [ ] Set up performance monitoring

### Week 2-3 (HIGH)
- [ ] Split wa-webhook into 5 focused functions
- [ ] Refactor 14 large files (>500 LOC)
- [ ] Implement caching layer
- [ ] Add rate limiting
- [ ] Clean up database functions

### Month 2-3 (MEDIUM)
- [ ] Event-driven architecture pilot
- [ ] Database partitioning for large tables
- [ ] Read replica setup
- [ ] Load testing and optimization
- [ ] Documentation updates

---

**Status:** ⚠️ OPTIMIZATION NEEDED  
**Next Review:** 2025-11-22  
**Owner:** DevOps Team
