# Week 6: Traffic Migration Implementation
**Date:** December 3, 2025  
**Phase:** Gradual Traffic Routing (10% → 50%)  
**Duration:** 5 days (~16 hours)  
**Status:** 🚀 Starting Now

---

## 🎯 Objective

Gradually route 10% → 50% of webhook traffic to `wa-webhook-unified` while maintaining:
- Error rate < 0.1%
- P95 latency < 2s
- Delivery rate > 99.9%
- Zero impact on protected webhooks

---

## 📋 Prerequisites

✅ Week 4: 6 functions deleted (assumed complete)
✅ Week 5: Domain integration complete
✅ wa-webhook-unified: Deployed with all domains
✅ Protected webhooks: Active and monitored

**Current State:**
- Functions: 68 (after Week 4 deletions)
- Traffic: 100% on legacy webhooks
- wa-webhook-unified: Ready but receiving 0% traffic

---

## 🏗️ Implementation Strategy

### Phase 1: Infrastructure Setup (Day 1-2)

**1. Database Migration: Routing Config Table**

```sql
-- Create webhook routing configuration
CREATE TABLE IF NOT EXISTS webhook_routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  enabled BOOLEAN NOT NULL DEFAULT false,
  domains TEXT[] NOT NULL DEFAULT ARRAY['jobs', 'marketplace', 'property']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert initial config (0% routing)
INSERT INTO webhook_routing_config (percentage, domains, enabled)
VALUES (0.00, ARRAY['jobs', 'marketplace', 'property']::TEXT[], true)
ON CONFLICT (id) DO NOTHING;

-- Function to update routing percentage
CREATE OR REPLACE FUNCTION update_routing_percentage(new_percentage DECIMAL)
RETURNS webhook_routing_config AS $$
DECLARE
  result webhook_routing_config;
BEGIN
  UPDATE webhook_routing_config
  SET percentage = new_percentage,
      updated_at = now()
  WHERE id = (SELECT id FROM webhook_routing_config ORDER BY created_at DESC LIMIT 1)
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create routing logs table
CREATE TABLE IF NOT EXISTS webhook_routing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_name TEXT NOT NULL,
  domain TEXT,
  routed_to TEXT NOT NULL, -- 'unified' or 'legacy'
  from_number TEXT,
  message_id TEXT,
  response_time_ms INTEGER,
  status TEXT, -- 'success' or 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for performance monitoring
CREATE INDEX IF NOT EXISTS idx_routing_logs_created_at 
  ON webhook_routing_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_logs_status 
  ON webhook_routing_logs(status);
CREATE INDEX IF NOT EXISTS idx_routing_logs_domain 
  ON webhook_routing_logs(domain);

-- Create monitoring view
CREATE OR REPLACE VIEW webhook_routing_stats AS
SELECT 
  domain,
  routed_to,
  COUNT(*) as request_count,
  AVG(response_time_ms) as avg_response_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_ms,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
  (SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100 as error_rate_pct,
  MAX(created_at) as last_request
FROM webhook_routing_logs
WHERE created_at > now() - interval '1 hour'
GROUP BY domain, routed_to
ORDER BY domain, routed_to;
```

**2. Deploy Traffic Router Function**

```typescript
// supabase/functions/webhook-traffic-router/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface RoutingConfig {
  percentage: number;
  enabled: boolean;
  domains: string[];
}

async function getRoutingConfig(): Promise<RoutingConfig> {
  const { data, error } = await supabase
    .from('webhook_routing_config')
    .select('percentage, enabled, domains')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    console.error('Failed to get routing config:', error);
    return { percentage: 0, enabled: false, domains: [] };
  }
  
  return data;
}

function determineDomain(payload: any): string {
  const messageBody = payload.message?.text?.body?.toLowerCase() || '';
  
  // Domain detection logic
  if (messageBody.includes('job') || messageBody.includes('hiring') || 
      messageBody.includes('apply') || messageBody.includes('career')) {
    return 'jobs';
  }
  
  if (messageBody.includes('property') || messageBody.includes('rent') || 
      messageBody.includes('apartment') || messageBody.includes('house')) {
    return 'property';
  }
  
  if (messageBody.includes('buy') || messageBody.includes('shop') || 
      messageBody.includes('product') || messageBody.includes('order')) {
    return 'marketplace';
  }
  
  // Default to first available domain or 'unknown'
  return 'unknown';
}

async function logRouting(data: {
  webhookName: string;
  domain: string;
  routedTo: string;
  fromNumber?: string;
  messageId?: string;
  responseTimeMs: number;
  status: string;
  errorMessage?: string;
}) {
  await supabase.from('webhook_routing_logs').insert({
    webhook_name: data.webhookName,
    domain: data.domain,
    routed_to: data.routedTo,
    from_number: data.fromNumber,
    message_id: data.messageId,
    response_time_ms: data.responseTimeMs,
    status: data.status,
    error_message: data.errorMessage
  });
}

serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  const url = new URL(req.url);
  const correlationId = crypto.randomUUID();
  
  try {
    // Parse webhook payload
    const payload = await req.json();
    const { from, message } = payload;
    
    // Get routing configuration
    const config = await getRoutingConfig();
    
    // Determine domain
    const domain = determineDomain(payload);
    
    // Check if domain should be routed
    const shouldRoute = config.enabled && 
                       config.domains.includes(domain) &&
                       Math.random() * 100 < config.percentage;
    
    const targetWebhook = shouldRoute ? 'wa-webhook-unified' : `wa-webhook-${domain}`;
    const targetUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${targetWebhook}`;
    
    // Forward request to target webhook
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        'X-Webhook-Domain': domain,
        'X-Routed-From': 'traffic-router',
      },
      body: JSON.stringify(payload)
    });
    
    const responseTime = Date.now() - startTime;
    const status = response.ok ? 'success' : 'error';
    
    // Log routing decision
    await logRouting({
      webhookName: targetWebhook,
      domain,
      routedTo: shouldRoute ? 'unified' : 'legacy',
      fromNumber: from,
      messageId: message?.id,
      responseTimeMs: responseTime,
      status,
      errorMessage: response.ok ? undefined : await response.text()
    });
    
    return response;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Router error:', error);
    
    await logRouting({
      webhookName: 'router-error',
      domain: 'unknown',
      routedTo: 'error',
      responseTimeMs: responseTime,
      status: 'error',
      errorMessage: error.message
    });
    
    return new Response(
      JSON.stringify({ error: 'Routing failed', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Phase 2: Gradual Rollout (Day 3-5)

**Day 3 Morning: 10% Traffic**

```bash
#!/bin/bash
# Enable 10% traffic routing

echo "🚀 Starting 10% traffic rollout..."

# Update routing percentage
psql "$DATABASE_URL" <<SQL
SELECT update_routing_percentage(10.00);
SELECT percentage, enabled, domains FROM webhook_routing_config 
ORDER BY created_at DESC LIMIT 1;
SQL

echo "✅ Routing set to 10%"
echo "⏰ Monitoring for 4 hours..."
```

**Monitoring (4 hours):**
```sql
-- Check routing stats every 15 minutes
SELECT * FROM webhook_routing_stats ORDER BY domain, routed_to;

-- Alert conditions:
-- - error_rate_pct > 0.1%
-- - p95_ms > 2000
-- - request_count unified < 8% (should be ~10%)
```

**Day 3 Afternoon: 25% Traffic**

```bash
#!/bin/bash
# Scale to 25% if 10% is stable

echo "📈 Scaling to 25% traffic..."

# Verify 10% was successful
ERROR_RATE=$(psql "$DATABASE_URL" -t -c "
  SELECT COALESCE(MAX(error_rate_pct), 0) 
  FROM webhook_routing_stats 
  WHERE routed_to = 'unified'
")

if (( $(echo "$ERROR_RATE < 0.1" | bc -l) )); then
  psql "$DATABASE_URL" -c "SELECT update_routing_percentage(25.00);"
  echo "✅ Scaled to 25%"
else
  echo "❌ Error rate too high ($ERROR_RATE%). Staying at 10%"
  exit 1
fi
```

**Day 4: 35% Traffic**

```bash
# Scale to 35% after 6 hours of stable 25%
psql "$DATABASE_URL" -c "SELECT update_routing_percentage(35.00);"
```

**Day 5: 50% Traffic**

```bash
# Scale to 50% - final Week 6 target
psql "$DATABASE_URL" -c "SELECT update_routing_percentage(50.00);"
```

---

## 📊 Monitoring Dashboard

**Real-time Metrics Query:**

```sql
-- Comprehensive monitoring view
SELECT 
  domain,
  routed_to,
  request_count,
  ROUND(avg_response_ms::numeric, 2) as avg_ms,
  ROUND(p95_ms::numeric, 2) as p95_ms,
  error_count,
  ROUND(error_rate_pct::numeric, 4) as error_rate,
  (request_count::float / SUM(request_count) OVER (PARTITION BY domain) * 100)::int as traffic_pct
FROM webhook_routing_stats
ORDER BY domain, routed_to;

-- Error analysis
SELECT 
  domain,
  routed_to,
  error_message,
  COUNT(*) as count,
  MAX(created_at) as last_occurred
FROM webhook_routing_logs
WHERE status = 'error'
  AND created_at > now() - interval '1 hour'
GROUP BY domain, routed_to, error_message
ORDER BY count DESC;
```

---

## ✅ Success Criteria

Week 6 Complete When:
- [ ] Routing config table created
- [ ] Traffic router function deployed
- [ ] 10% traffic stable (4h, error < 0.1%)
- [ ] 25% traffic stable (4h, error < 0.1%)
- [ ] 35% traffic stable (6h, error < 0.1%)
- [ ] 50% traffic stable (24h, error < 0.1%)
- [ ] P95 latency < 2s maintained
- [ ] Protected webhooks unaffected
- [ ] Monitoring dashboard operational

---

## 🔄 Rollback Plan

If error rate > 0.1% or P95 > 2s:

```sql
-- Immediate rollback to 0%
SELECT update_routing_percentage(0.00);

-- Or step back one level
-- From 50% → 35%
SELECT update_routing_percentage(35.00);

-- Disable routing entirely
UPDATE webhook_routing_config 
SET enabled = false 
WHERE id = (SELECT id FROM webhook_routing_config ORDER BY created_at DESC LIMIT 1);
```

---

## 📈 Expected Results

| Metric | Target | Verification |
|--------|--------|--------------|
| **Traffic Routed** | 50% | Routing stats view |
| **Error Rate** | < 0.1% | `error_rate_pct` column |
| **P95 Latency** | < 2000ms | `p95_ms` column |
| **Unified Requests** | ~50% of total | Traffic distribution |
| **Legacy Requests** | ~50% of total | Traffic distribution |

---

## 🎯 Next Steps After Week 6

**Week 7 Preview:**
- Day 1-2: Scale to 75% traffic
- Day 3-4: Scale to 100% traffic
- Day 5-6: 48h stability window
- Day 7: Delete 3 legacy webhooks (jobs, marketplace, property)
- Result: 68 → 65 functions

---

**Status:** Ready to execute  
**Start:** Immediately  
**Duration:** 5 days  
**Risk:** MEDIUM (gradual rollout minimizes impact)

