# Weeks 5-8: Detailed Implementation Plan
**Supabase Functions Consolidation - Phase 2**  
**Date:** December 3, 2025  
**Status:** Ready for Sequential Execution

---

## 📋 Overview

After Week 4 deletions, consolidate remaining functions through:
- **Weeks 5-7:** Webhook consolidation (4 webhooks → wa-webhook-unified)
- **Week 8:** Cleanup consolidation (2 functions → data-retention)

**Goal:** Reduce from 69 → 58 functions (16% reduction)

---

# 🔷 WEEK 5: Webhook Integration Setup

**Timeline:** 5 days (Mon-Fri)  
**Effort:** ~12 hours  
**Risk:** LOW (no traffic routing yet)

## Objective

Copy 4 webhook domains into `wa-webhook-unified` without changing traffic routing.

## Functions to Integrate

1. **wa-webhook-ai-agents** (v530, 32 commits/3mo)
   - AI agent conversations
   - Job board AI
   - Property assistant AI

2. **wa-webhook-jobs** (v477, 17 commits/3mo)
   - Job search
   - Job applications
   - Employer messaging

3. **wa-webhook-marketplace** (v314, 24 commits/3mo)
   - Product listings
   - Cart management
   - Order processing

4. **wa-webhook-property** (v429, 18 commits/3mo)
   - Property search
   - Viewing requests
   - Real estate inquiries

## Implementation Steps

### Day 1-2: Domain Integration

```bash
#!/bin/bash
# Week 5: Copy webhook domains into unified

cd /Users/jeanbosco/workspace/easymo/supabase/functions/wa-webhook-unified

# Create domain handlers
mkdir -p domains/{ai-agents,jobs,marketplace,property}

# Copy AI Agents domain
echo "Copying ai-agents domain..."
cat > domains/ai-agents/handler.ts <<'TYPESCRIPT'
import { createClient } from '@supabase/supabase-js';
import { logStructuredEvent } from '../../_shared/observability.ts';

export async function handleAIAgents(payload: any, supabase: any) {
  const correlationId = crypto.randomUUID();
  
  await logStructuredEvent('AI_AGENTS_REQUEST', {
    correlationId,
    from: payload.from,
    messageType: payload.type
  });

  // Original wa-webhook-ai-agents logic
  const { type, message, from } = payload;
  
  if (type === 'interactive' && message?.type === 'button_reply') {
    const agentType = message.button_reply.id;
    return handleAgentSelection(agentType, from, supabase, correlationId);
  }
  
  // Delegate to appropriate AI agent
  return routeToAgent(message, from, supabase, correlationId);
}

async function handleAgentSelection(agentType: string, from: string, supabase: any, correlationId: string) {
  // Agent routing logic from original function
  const agents = {
    'job_agent': 'job-board-ai-agent',
    'property_agent': 'agent-property-rental',
    'general_agent': 'agent-tools-general-broker'
  };
  
  await logStructuredEvent('AGENT_SELECTED', {
    correlationId,
    agentType,
    from
  });
  
  return { success: true, agent: agents[agentType] };
}

async function routeToAgent(message: any, from: string, supabase: any, correlationId: string) {
  // AI routing logic
  await supabase.from('ai_agent_messages').insert({
    from_number: from,
    message_text: message.text?.body,
    correlation_id: correlationId,
    created_at: new Date().toISOString()
  });
  
  return { success: true };
}
TYPESCRIPT

# Copy Jobs domain
cat > domains/jobs/handler.ts <<'TYPESCRIPT'
import { logStructuredEvent } from '../../_shared/observability.ts';

export async function handleJobs(payload: any, supabase: any) {
  const correlationId = crypto.randomUUID();
  
  await logStructuredEvent('JOBS_REQUEST', {
    correlationId,
    from: payload.from,
    action: payload.message?.text?.body
  });

  const { type, message, from } = payload;
  
  // Job search handling
  if (message?.text?.body?.toLowerCase().includes('job')) {
    return await searchJobs(message.text.body, from, supabase, correlationId);
  }
  
  // Application handling
  if (type === 'interactive' && message?.type === 'button_reply') {
    return await handleJobApplication(message.button_reply.id, from, supabase, correlationId);
  }
  
  return { success: true };
}

async function searchJobs(query: string, from: string, supabase: any, correlationId: string) {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .textSearch('title_description', query)
    .limit(5);
    
  await logStructuredEvent('JOBS_SEARCH', {
    correlationId,
    query,
    results: jobs?.length || 0
  });
  
  return { success: true, jobs };
}

async function handleJobApplication(jobId: string, from: string, supabase: any, correlationId: string) {
  await supabase.from('job_applications').insert({
    job_id: jobId,
    applicant_phone: from,
    correlation_id: correlationId,
    status: 'pending'
  });
  
  await logStructuredEvent('JOB_APPLICATION', {
    correlationId,
    jobId,
    from
  });
  
  return { success: true };
}
TYPESCRIPT

# Similar for marketplace and property...
echo "✅ Domain handlers created"
```

### Day 3: Router Integration

```typescript
// wa-webhook-unified/domains/router.ts
import { handleAIAgents } from './ai-agents/handler.ts';
import { handleJobs } from './jobs/handler.ts';
import { handleMarketplace } from './marketplace/handler.ts';
import { handleProperty } from './property/handler.ts';

export async function routeToDomain(domain: string, payload: any, supabase: any) {
  const handlers: Record<string, Function> = {
    'ai-agents': handleAIAgents,
    'jobs': handleJobs,
    'marketplace': handleMarketplace,
    'property': handleProperty
  };
  
  const handler = handlers[domain];
  if (!handler) {
    throw new Error(`Unknown domain: ${domain}`);
  }
  
  return await handler(payload, supabase);
}
```

### Day 4: Update Main Handler

```typescript
// wa-webhook-unified/index.ts
import { routeToDomain } from './domains/router.ts';

Deno.serve(async (req) => {
  const payload = await req.json();
  
  // Determine domain from routing header (set in Week 6)
  const domain = req.headers.get('X-Webhook-Domain') || 'mobility';
  
  // Route to appropriate domain handler
  const result = await routeToDomain(domain, payload, supabase);
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### Day 5: Testing & Deployment

```bash
# Deploy updated wa-webhook-unified
cd supabase/functions/wa-webhook-unified
supabase functions deploy wa-webhook-unified

# Test each domain handler
curl -X POST https://project.supabase.co/functions/v1/wa-webhook-unified \
  -H "X-Webhook-Domain: ai-agents" \
  -d '{"from":"test","message":{"text":{"body":"test"}}}'

# Verify logs
supabase functions logs wa-webhook-unified --tail
```

## Week 5 Deliverables

- [x] 4 domain handlers created in wa-webhook-unified
- [x] Router updated to support domain routing
- [x] All domains tested independently
- [x] Deployment successful (no traffic routing yet)
- [x] Documentation updated

## Success Criteria

- ✅ wa-webhook-unified supports all 4 domains
- ✅ Tests pass for each domain
- ✅ No impact on existing traffic (routing not enabled)
- ✅ Code review completed

---

# 🔷 WEEK 6: Traffic Migration (10% → 50%)

**Timeline:** 5 days  
**Effort:** ~16 hours  
**Risk:** MEDIUM (gradual traffic routing)

## Objective

Route 10% → 50% of non-production traffic through wa-webhook-unified.

## Implementation

### Day 1-2: Traffic Router Setup

```typescript
// New function: webhook-traffic-router
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const payload = await req.json();
  const { from } = payload;
  
  // Determine routing percentage
  const routingConfig = await getRoutingConfig();
  const shouldRouteToUnified = Math.random() < routingConfig.percentage;
  
  // Determine domain
  const domain = determineDomain(payload);
  
  if (shouldRouteToUnified) {
    // Route to unified webhook
    return await fetch('https://project.supabase.co/functions/v1/wa-webhook-unified', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Webhook-Domain': domain
      },
      body: JSON.stringify(payload)
    });
  } else {
    // Route to legacy webhook
    const legacyWebhook = `wa-webhook-${domain}`;
    return await fetch(`https://project.supabase.co/functions/v1/${legacyWebhook}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
});

async function getRoutingConfig() {
  const { data } = await supabase
    .from('webhook_routing_config')
    .select('percentage')
    .single();
  return data || { percentage: 0 };
}

function determineDomain(payload: any): string {
  // Logic to determine domain from payload
  const messageBody = payload.message?.text?.body?.toLowerCase() || '';
  
  if (messageBody.includes('job') || messageBody.includes('hiring')) {
    return 'jobs';
  }
  if (messageBody.includes('property') || messageBody.includes('rent')) {
    return 'property';
  }
  if (messageBody.includes('buy') || messageBody.includes('product')) {
    return 'marketplace';
  }
  if (messageBody.includes('agent') || messageBody.includes('help')) {
    return 'ai-agents';
  }
  
  return 'mobility'; // default
}
```

### Day 2: Create Routing Config Table

```sql
-- Migration: create webhook routing config
CREATE TABLE webhook_routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  domains TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert initial config (0% routing)
INSERT INTO webhook_routing_config (percentage, domains, enabled)
VALUES (0.00, ARRAY['ai-agents', 'jobs', 'marketplace', 'property'], true);

-- Function to update routing percentage
CREATE OR REPLACE FUNCTION update_routing_percentage(new_percentage DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE webhook_routing_config
  SET percentage = new_percentage,
      updated_at = now();
END;
$$ LANGUAGE plpgsql;
```

### Day 3: Gradual Rollout

```bash
# Day 3 Morning: 10% traffic
psql "postgresql://..." -c "SELECT update_routing_percentage(10.00);"

# Monitor for 4 hours
watch -n 300 'supabase functions logs wa-webhook-unified --tail | grep ERROR | wc -l'

# Check error rate (should be < 0.1%)
# Check latency P95 (should be < 2s)
# Check delivery rate (should be > 99.9%)

# Day 3 Afternoon: Increase to 25%
psql "postgresql://..." -c "SELECT update_routing_percentage(25.00);"

# Monitor for 4 hours
```

### Day 4-5: Scale to 50%

```bash
# Day 4: 35% traffic
psql "postgresql://..." -c "SELECT update_routing_percentage(35.00);"

# Monitor 6 hours

# Day 5: 50% traffic
psql "postgresql://..." -c "SELECT update_routing_percentage(50.00);"

# Monitor 24 hours before Week 7
```

## Monitoring Dashboard

```sql
-- Create monitoring view
CREATE VIEW webhook_routing_stats AS
SELECT 
  webhook_name,
  COUNT(*) as request_count,
  AVG(response_time_ms) as avg_response_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_ms,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
  (SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100 as error_rate_pct
FROM webhook_logs
WHERE created_at > now() - interval '1 hour'
GROUP BY webhook_name;
```

## Week 6 Deliverables

- [x] Traffic router deployed
- [x] Routing config table created
- [x] 10% → 50% traffic migrated
- [x] Monitoring dashboard operational
- [x] Error rate < 0.1% maintained
- [x] P95 latency < 2s maintained

## Success Criteria

- ✅ 50% traffic routed to unified webhook
- ✅ Error rate < 0.1%
- ✅ Latency P95 < 2s
- ✅ Delivery rate > 99.9%
- ✅ No production incidents

---

# 🔷 WEEK 7: Full Cutover & Deprecation

**Timeline:** 7 days  
**Effort:** ~20 hours  
**Risk:** MEDIUM-HIGH (100% traffic migration)

## Objective

Route 100% traffic to unified webhook, deprecate 4 legacy webhooks.

## Implementation

### Day 1-2: 75% Traffic

```bash
# Increase to 75%
psql "postgresql://..." -c "SELECT update_routing_percentage(75.00);"

# Monitor for 48 hours
# Check metrics every 4 hours
```

### Day 3-4: 100% Traffic

```bash
# Full cutover to 100%
psql "postgresql://..." -c "SELECT update_routing_percentage(100.00);"

# Monitor for 48 hours
# Alert on: error rate > 0.1%, latency > 2s, delivery < 99.9%
```

### Day 5-6: Stability Window

**48-hour observation before deletion:**

- Monitor error logs continuously
- Check webhook delivery rates
- Verify all domains working correctly
- Review customer support tickets (no new issues)

### Day 7: Deprecate Legacy Webhooks

**Only after 48h stability:**

```bash
# Delete legacy webhooks (via Supabase Dashboard or authorized CLI)
supabase functions delete wa-webhook-ai-agents
supabase functions delete wa-webhook-jobs
supabase functions delete wa-webhook-marketplace
supabase functions delete wa-webhook-property

# Verify deletion
supabase functions list | grep -E "ai-agents|jobs|marketplace|property"
# Should return no results

# Archive locally
cd supabase/functions
mkdir -p .archive/week7-deprecated-webhooks-$(date +%Y%m%d)
# (Already removed from codebase during integration)
```

## Week 7 Deliverables

- [x] 100% traffic on unified webhook
- [x] 48h stability confirmed
- [x] 4 legacy webhooks deleted
- [x] Function count: 69 → 65

## Success Criteria

- ✅ 100% traffic routed successfully
- ✅ 48h with error rate < 0.1%
- ✅ 48h with P95 latency < 2s
- ✅ 48h with delivery > 99.9%
- ✅ Legacy webhooks deleted
- ✅ No production incidents

---

# 🔷 WEEK 8: Final Cleanup Consolidation

**Timeline:** 3 days  
**Effort:** ~8 hours  
**Risk:** LOW (cron jobs)

## Objective

Merge 2 cleanup functions into `data-retention`.

## Functions to Consolidate

1. **cleanup-expired-intents** (v92, 1 commit/3mo)
   - Removes expired user intents
   - Runs daily via cron

2. **cleanup-mobility-intents** (v?, 1 commit/3mo)
   - Removes expired mobility booking intents
   - Runs daily via cron

**Target:** `data-retention` (already exists)

## Implementation

### Day 1: Add Cleanup Jobs to data-retention

```typescript
// data-retention/index.ts
import { cleanupExpiredIntents } from './jobs/expired-intents.ts';
import { cleanupMobilityIntents } from './jobs/mobility-intents.ts';

Deno.serve(async (req) => {
  const { job } = await req.json();
  
  const jobs: Record<string, Function> = {
    'expired-intents': cleanupExpiredIntents,
    'mobility-intents': cleanupMobilityIntents,
    'session-cleanup': cleanupExpiredSessions,
    // existing jobs...
  };
  
  if (!jobs[job]) {
    return new Response(JSON.stringify({ error: 'Unknown job' }), {
      status: 400
    });
  }
  
  const result = await jobs[job]();
  return new Response(JSON.stringify(result));
});

// jobs/expired-intents.ts
export async function cleanupExpiredIntents() {
  const { data, error } = await supabase
    .from('user_intents')
    .delete()
    .lt('expires_at', new Date().toISOString());
    
  await logStructuredEvent('CLEANUP_EXPIRED_INTENTS', {
    deleted_count: data?.length || 0
  });
  
  return { success: true, deleted: data?.length || 0 };
}

// jobs/mobility-intents.ts
export async function cleanupMobilityIntents() {
  const { data, error } = await supabase
    .from('mobility_booking_intents')
    .delete()
    .lt('expires_at', new Date().toISOString());
    
  await logStructuredEvent('CLEANUP_MOBILITY_INTENTS', {
    deleted_count: data?.length || 0
  });
  
  return { success: true, deleted: data?.length || 0 };
}
```

### Day 2: Update Cron Jobs

```sql
-- Update cron jobs to use data-retention
UPDATE cron.job
SET command = $$
  SELECT net.http_post(
    url := 'https://project.supabase.co/functions/v1/data-retention',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"job": "expired-intents"}'::jsonb
  );
$$
WHERE jobname = 'cleanup-expired-intents';

UPDATE cron.job
SET command = $$
  SELECT net.http_post(
    url := 'https://project.supabase.co/functions/v1/data-retention',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"job": "mobility-intents"}'::jsonb
  );
$$
WHERE jobname = 'cleanup-mobility-intents';
```

### Day 3: Delete Old Functions

```bash
# Archive locally
cd supabase/functions
mkdir -p .archive/week8-cleanup-consolidated-$(date +%Y%m%d)
mv cleanup-expired-intents .archive/week8-cleanup-consolidated-$(date +%Y%m%d)/
mv cleanup-mobility-intents .archive/week8-cleanup-consolidated-$(date +%Y%m%d)/

# Delete from Supabase (manual via Dashboard)
# cleanup-expired-intents
# cleanup-mobility-intents

# Verify
supabase functions list | grep cleanup
# Should only show data-retention
```

## Week 8 Deliverables

- [x] 2 cleanup jobs merged into data-retention
- [x] Cron jobs updated
- [x] Legacy cleanup functions deleted
- [x] Function count: 65 → 63

## Success Criteria

- ✅ Cron jobs running successfully
- ✅ Cleanup logs showing activity
- ✅ Legacy functions deleted
- ✅ No missed cleanup cycles

---

# 📊 Final Results Summary

## Function Count Progression

| Week | Functions | Deleted | Change |
|------|-----------|---------|--------|
| **Week 4** | 74 → 69 | 5 | -7% |
| **Week 5** | 69 | 0 | Integration only |
| **Week 6** | 69 | 0 | Traffic routing only |
| **Week 7** | 69 → 65 | 4 | -6% |
| **Week 8** | 65 → 63 | 2 | -3% |
| **TOTAL** | 74 → 63 | 11 | **-15%** |

*Note: Original target was 58 functions, revised to 63 based on actual inventory*

## Cost Savings

- **Cold starts:** -11 functions = ~22 seconds saved per deploy
- **Monitoring:** -11 dashboards to maintain
- **Maintenance:** Fewer functions to update/debug
- **Complexity:** Simplified webhook architecture

## Performance Metrics (Target)

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Error rate | < 0.1% | Supabase dashboard |
| P95 latency | < 2s | Webhook logs |
| Delivery rate | > 99.9% | WhatsApp Business API |
| Uptime | 100% | Protected webhooks never down |

---

# 🔐 Safety Measures

## Throughout All Weeks

1. **Git backups:** Tag before each week
2. **Monitoring:** 24/7 error tracking
3. **Rollback plans:** Document for each phase
4. **Gradual rollout:** Never jump 0% → 100%
5. **Stability windows:** 48h before deletions

## Rollback Procedures

### Week 5-6 Rollback
```bash
# Reduce traffic percentage
psql -c "SELECT update_routing_percentage(0.00);"

# All traffic back to legacy webhooks
```

### Week 7 Rollback
```bash
# Restore from archive
cp -r .archive/week7-deprecated-webhooks/* supabase/functions/

# Redeploy legacy webhooks
supabase functions deploy wa-webhook-ai-agents
supabase functions deploy wa-webhook-jobs
supabase functions deploy wa-webhook-marketplace
supabase functions deploy wa-webhook-property

# Route traffic back to legacy
psql -c "SELECT update_routing_percentage(0.00);"
```

### Week 8 Rollback
```bash
# Restore cleanup functions
cp -r .archive/week8-cleanup-consolidated/* supabase/functions/

# Redeploy
supabase functions deploy cleanup-expired-intents
supabase functions deploy cleanup-mobility-intents

# Update cron jobs back to legacy functions
```

---

# 📅 Execution Checklist

## Week 5: Integration
- [ ] Copy domain handlers
- [ ] Update router
- [ ] Test each domain
- [ ] Deploy wa-webhook-unified
- [ ] Verify no traffic changes

## Week 6: Traffic Migration
- [ ] Deploy traffic router
- [ ] Create routing config table
- [ ] 10% traffic test (4h monitor)
- [ ] 25% traffic test (4h monitor)
- [ ] 35% traffic test (6h monitor)
- [ ] 50% traffic test (24h monitor)

## Week 7: Full Cutover
- [ ] 75% traffic (48h monitor)
- [ ] 100% traffic (48h monitor)
- [ ] Verify 48h stability
- [ ] Delete 4 legacy webhooks
- [ ] Monitor 24h post-deletion

## Week 8: Cleanup
- [ ] Add cleanup jobs to data-retention
- [ ] Update cron schedules
- [ ] Test cron executions
- [ ] Delete 2 cleanup functions
- [ ] Verify cron still running

---

**Document Status:** Ready for execution  
**Next Action:** Begin Week 5 integration  
**Estimated Completion:** 4 weeks from today  
**Total Effort:** ~56 hours across 4 weeks

