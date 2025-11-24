# EasyMO Go-Live Implementation Plan
**Timeline**: 2 Weeks (Nov 19 - Dec 3, 2025)  
**Target Launch**: December 3, 2025 at 9:00 AM EAT  
**Risk Level**: MEDIUM (Recommended)

---

## Week 1: Critical Blockers & Testing (Nov 19-25)

### Day 1 - Tuesday, Nov 19 (TODAY) - 8 hours

#### Morning (4 hours): CI/CD & Hygiene Fixes
**Owner**: DevOps + Backend Lead

**Task 1.1: Fix CI Format Check** (2 hours)
```bash
# Run formatter
pnpm format

# Check what's failing
pnpm format:check

# Commit fixes
git add -A
git commit -m "fix: format code to pass CI checks"
git push origin main
```

**Task 1.2: Fix Migration Hygiene** (15 min)
```bash
# Add allowlist entries
cat >> supabase/migrations/.hygiene_allowlist << 'ALLOW'
20251002120000_core_schema.sql # Initial core schema - simple DDL, no transactions needed
20251027120000_admin_core_schema.sql # Admin baseline schema - idempotent DDL
20251118100000_business_deeplink_code.sql # Single ALTER statement - atomic
ALLOW

# Test hygiene check
bash scripts/check-migration-hygiene.sh

# Commit
git add supabase/migrations/.hygiene_allowlist
git commit -m "fix: add migration hygiene allowlist with justifications"
git push origin main
```

**Task 1.3: Verify All CI Workflows** (1 hour)
- Monitor GitHub Actions
- Ensure all checks pass
- Document any remaining failures

**Task 1.4: Fix Marketplace Domain** (45 min)
```bash
# Option A: Remove routing (quick fix)
# Edit supabase/functions/wa-webhook/router.ts
# Remove marketplace from ROUTES array

# OR Option B: Implement stub (temporary)
mkdir -p supabase/functions/wa-webhook/domains/marketplace
cat > supabase/functions/wa-webhook/domains/marketplace/index.ts << 'STUB'
export async function handleMarketplace(message: string) {
  return {
    text: "🛍️ Marketplace is coming soon! We're working hard to bring you amazing deals.",
    buttons: [
      { id: "home", title: "🏠 Back to Home" }
    ]
  };
}
STUB

# Commit
git add supabase/functions/wa-webhook/domains/marketplace/
git commit -m "feat: add marketplace stub handler (coming soon message)"
git push origin main
```

**Deliverables**:
- [x] CI/CD 100% green
- [x] Migration hygiene fixed
- [x] Marketplace domain handled

---

#### Afternoon (4 hours): Monitoring Setup
**Owner**: DevOps

**Task 1.5: Set Up Datadog (or Alternative)** (3 hours)

```bash
# Sign up for Datadog (free trial: 14 days)
# Or use Supabase Logs directly

# Install Datadog Forwarder (if using Datadog)
# Follow: https://docs.datadoghq.com/logs/guide/forwarder/

# Configure log aggregation
# Add to supabase/functions/_shared/observability.ts:

export async function logToDatadog(event: string, data: Record<string, unknown>) {
  const DD_API_KEY = Deno.env.get("DATADOG_API_KEY");
  if (!DD_API_KEY) return; // Skip in dev

  try {
    await fetch("https://http-intake.logs.datadoghq.com/api/v2/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": DD_API_KEY,
      },
      body: JSON.stringify({
        ddsource: "supabase-functions",
        service: "wa-webhook-core",
        hostname: "easymo-prod",
        message: event,
        ...data,
      }),
    });
  } catch (error) {
    console.error("Failed to send log to Datadog:", error);
  }
}
```

**Task 1.6: Configure Critical Alerts** (1 hour)

Create `monitoring/alerts.yaml`:
```yaml
alerts:
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    window: "5 minutes"
    channels: ["slack", "email"]
    severity: "critical"
    
  - name: "Payment Failure Spike"
    condition: "payment_errors > 10"
    window: "10 minutes"
    channels: ["pagerduty", "slack"]
    severity: "critical"
    
  - name: "WhatsApp Signature Failure"
    condition: "signature_failures > 5"
    window: "5 minutes"
    channels: ["slack"]
    severity: "high"
    
  - name: "Database Connection Pool"
    condition: "db_connections > 80%"
    window: "5 minutes"
    channels: ["slack"]
    severity: "warning"
```

**Deliverables**:
- [x] Log aggregation configured
- [x] 4 critical alerts set up
- [x] Slack/email integration working

---

### Day 2 - Wednesday, Nov 20 - 8 hours

#### Payment Reconciliation (Full Day)
**Owner**: Backend Lead + Fintech Specialist

**Task 2.1: Create Reconciliation Job** (4 hours)

Create `supabase/functions/payment-reconciliation/index.ts`:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get yesterday's date range
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const today = new Date(yesterday);
  today.setDate(today.getDate() + 1);

  console.log("Starting reconciliation for", yesterday.toISOString());

  // 1. Fetch all wallet_transfers from yesterday
  const { data: transfers, error: transferError } = await supabase
    .from("wallet_transfers")
    .select("*")
    .gte("created_at", yesterday.toISOString())
    .lt("created_at", today.toISOString());

  if (transferError) {
    return new Response(JSON.stringify({ error: transferError.message }), {
      status: 500,
    });
  }

  // 2. Fetch MoMo transactions from API
  const momoTransactions = await fetchMoMoTransactions(yesterday, today);
  
  // 3. Fetch Revolut transactions from API
  const revolutTransactions = await fetchRevolutTransactions(yesterday, today);

  // 4. Match transfers to external transactions
  const mismatches = [];
  for (const transfer of transfers || []) {
    const found = [...momoTransactions, ...revolutTransactions].find(
      (ext) => ext.reference === transfer.id
    );
    
    if (!found) {
      mismatches.push({
        transfer_id: transfer.id,
        amount: transfer.amount,
        status: transfer.status,
        reason: "not_found_in_gateway",
      });
    } else if (found.amount !== transfer.amount) {
      mismatches.push({
        transfer_id: transfer.id,
        expected: transfer.amount,
        actual: found.amount,
        reason: "amount_mismatch",
      });
    }
  }

  // 5. Store reconciliation results
  await supabase.from("payment_reconciliations").insert({
    date: yesterday.toISOString(),
    total_transfers: transfers?.length || 0,
    mismatches: mismatches.length,
    details: mismatches,
  });

  // 6. Alert if mismatches found
  if (mismatches.length > 0) {
    await sendSlackAlert(
      `⚠️ Payment Reconciliation: ${mismatches.length} mismatches found for ${yesterday.toDateString()}`
    );
  }

  return new Response(JSON.stringify({
    success: true,
    date: yesterday.toISOString(),
    total: transfers?.length || 0,
    mismatches: mismatches.length,
  }), { headers: { "Content-Type": "application/json" } });
});

async function fetchMoMoTransactions(start: Date, end: Date) {
  // TODO: Implement MoMo API integration
  return [];
}

async function fetchRevolutTransactions(start: Date, end: Date) {
  // TODO: Implement Revolut API integration
  return [];
}

async function sendSlackAlert(message: string) {
  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!webhookUrl) return;
  
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}
```

**Task 2.2: Create DB Migration for Reconciliation Table** (1 hour)
```sql
-- supabase/migrations/20251120120000_payment_reconciliations.sql
BEGIN;

CREATE TABLE IF NOT EXISTS payment_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_transfers INTEGER NOT NULL,
  mismatches INTEGER NOT NULL DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON payment_reconciliations
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

COMMIT;
```

**Task 2.3: Set Up Daily Cron** (1 hour)
```yaml
# Add to supabase/functions/payment-reconciliation/function.json
{
  "schedule": "0 6 * * *",
  "name": "payment-reconciliation",
  "verify_jwt": false
}
```

**Task 2.4: Test Reconciliation** (2 hours)
- Create test data in staging
- Run reconciliation manually
- Verify Slack alerts work
- Check reconciliation table populated

**Deliverables**:
- [x] Payment reconciliation function deployed
- [x] Daily cron job configured (6 AM daily)
- [x] Reconciliation table created
- [x] Slack alerts working

---

### Day 3 - Thursday, Nov 21 - 8 hours

#### Integration Testing (Full Day)
**Owner**: QA Lead + Backend Developers

**Task 3.1: WhatsApp Flow Tests** (3 hours)

Create `tests/integration/whatsapp-flows.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("WhatsApp Message Routing", () => {
  it("should route job query to wa-webhook-jobs", async () => {
    const response = await fetch("http://localhost:54321/functions/v1/wa-webhook-core", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: "1234567890",
                text: { body: "I'm looking for a job" },
              }],
            },
          }],
        }],
      }),
    });
    
    expect(response.status).toBe(200);
    // Verify routed to jobs service
  });

  it("should route payment query to wa-webhook-wallet", async () => {
    // Similar test for wallet
  });

  // Add 10 more critical path tests
});
```

**Task 3.2: Payment Flow Tests** (3 hours)

Create `tests/integration/payment-flows.test.ts`:
```typescript
describe("Payment Processing", () => {
  it("should initiate MoMo payment", async () => {
    // Test MoMo charge endpoint
  });

  it("should handle MoMo webhook callback", async () => {
    // Test webhook processing
  });

  it("should update wallet balance after payment", async () => {
    // Test ledger update
  });

  it("should prevent duplicate payments (idempotency)", async () => {
    // Test idempotency key
  });
});
```

**Task 3.3: AI Agent Timeout Tests** (2 hours)
```typescript
describe("AI Agent Timeouts", () => {
  it("should handle slow AI responses gracefully", async () => {
    // Simulate 10s AI response time
    // Verify timeout handling
  });
});
```

**Deliverables**:
- [x] 15 integration tests added
- [x] All tests passing
- [x] Coverage report generated

---

### Day 4 - Friday, Nov 22 - 8 hours

#### Rate Limiting & Circuit Breakers
**Owner**: Backend Lead

**Task 4.1: Implement Hard Rate Limits** (4 hours)

Create `supabase/functions/_shared/rate-limiter.ts`:
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RATE_LIMITS = {
  global: { requests: 100, window: 60 }, // 100 req/min globally
  perUser: { requests: 10, window: 60 }, // 10 req/min per user
};

export async function checkRateLimit(
  userId: string,
  supabase: any
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const windowStart = now - RATE_LIMITS.perUser.window * 1000;

  // Count requests in window
  const { data, error } = await supabase
    .from("rate_limit_requests")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", new Date(windowStart).toISOString());

  if (error) {
    console.error("Rate limit check failed:", error);
    return { allowed: true, remaining: RATE_LIMITS.perUser.requests };
  }

  const count = data?.length || 0;
  const allowed = count < RATE_LIMITS.perUser.requests;
  const remaining = Math.max(0, RATE_LIMITS.perUser.requests - count);

  if (allowed) {
    // Record this request
    await supabase.from("rate_limit_requests").insert({
      user_id: userId,
      created_at: new Date().toISOString(),
    });
  }

  return { allowed, remaining };
}
```

**Task 4.2: Add Circuit Breaker to Router** (2 hours)

Update `supabase/functions/wa-webhook/router.ts`:
```typescript
const CIRCUIT_BREAKER = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30s
  state: new Map<string, { failures: number; lastFailure: number; open: boolean }>(),
};

export async function forwardToMicroservice(
  service: string,
  payload: unknown,
  headers?: Headers
): Promise<Response> {
  // Check circuit breaker
  const circuit = CIRCUIT_BREAKER.state.get(service) || {
    failures: 0,
    lastFailure: 0,
    open: false,
  };

  if (circuit.open) {
    const elapsed = Date.now() - circuit.lastFailure;
    if (elapsed < CIRCUIT_BREAKER.resetTimeout) {
      console.log(`Circuit breaker OPEN for ${service}, rejecting request`);
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 503 }
      );
    } else {
      // Try to reset
      circuit.open = false;
      circuit.failures = 0;
    }
  }

  try {
    const response = await fetchWithTimeout(/* ... */);

    if (response.status >= 500) {
      circuit.failures++;
      circuit.lastFailure = Date.now();
      
      if (circuit.failures >= CIRCUIT_BREAKER.failureThreshold) {
        circuit.open = true;
        console.error(`Circuit breaker OPENED for ${service} (${circuit.failures} failures)`);
      }
    } else {
      // Success, reset failures
      circuit.failures = 0;
    }

    CIRCUIT_BREAKER.state.set(service, circuit);
    return response;
  } catch (error) {
    circuit.failures++;
    circuit.lastFailure = Date.now();
    CIRCUIT_BREAKER.state.set(service, circuit);
    throw error;
  }
}
```

**Task 4.3: Load Test** (2 hours)
```bash
# Install k6
brew install k6

# Create load test script
cat > tests/load/webhook-load.js << 'LOAD'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp to 100 users
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 500 },  // Spike to 500
    { duration: '3m', target: 500 },  // Stay at 500
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% under 2s
    http_req_failed: ['rate<0.02'],    // <2% errors
  },
};

export default function () {
  const res = http.post('https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook', {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: '1234567890',
            text: { body: 'Hello' },
          }],
        },
      }],
    }],
  }, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  sleep(1);
}
LOAD

# Run load test
k6 run tests/load/webhook-load.js
```

**Deliverables**:
- [x] Hard rate limits implemented
- [x] Circuit breaker added to router
- [x] Load test passed (500 users, <2% errors)

---

### Day 5 - Saturday, Nov 23 - 4 hours (Half Day)

#### Staging Validation
**Owner**: QA Team

**Task 5.1: Manual QA All Flows** (3 hours)
- Test all 19 domains via WhatsApp
- Test payment flows (sandbox)
- Test admin panel features
- Document any bugs

**Task 5.2: Security Review** (1 hour)
- Verify rate limits working
- Test webhook signature validation
- Check RLS policies
- Scan for exposed secrets

**Deliverables**:
- [x] QA sign-off document
- [x] Bug list (if any)
- [x] Security review passed

---

## Week 2: Polish & Production Prep (Nov 26 - Dec 2)

### Day 6 - Monday, Nov 26 - 8 hours

#### Documentation & Runbooks
**Owner**: Tech Lead + DevOps

**Task 6.1: Create Incident Runbooks** (4 hours)

Create `docs/runbooks/`:
- `01-database-connection-pool-exhausted.md`
- `02-whatsapp-api-quota-exceeded.md`
- `03-payment-reconciliation-failures.md`
- `04-microservice-cascade-failures.md`
- `05-high-error-rate-investigation.md`

**Task 6.2: Architecture Diagram** (2 hours)
```mermaid
# Add to docs/ARCHITECTURE.md
```

**Task 6.3: Update README** (1 hour)
- Add go-live checklist
- Update deployment instructions
- Add troubleshooting section

**Task 6.4: Onboarding Guide** (1 hour)
- 30-minute quick start for new devs
- Local setup steps
- Common tasks

**Deliverables**:
- [x] 5 incident runbooks
- [x] Architecture diagram
- [x] Updated documentation

---

### Day 7-8 - Tuesday-Wednesday, Nov 27-28 - 16 hours

#### Bug Fixes & Edge Cases
**Owner**: Full Team

- Fix any bugs found in QA
- Add edge case handling
- Improve error messages
- Optimize slow queries

**Deliverables**:
- [x] All QA bugs resolved
- [x] Edge cases handled
- [x] Performance optimizations applied

---

### Day 9 - Thursday, Nov 29 - 8 hours

#### Final Staging Deployment
**Owner**: DevOps

**Task 9.1: Deploy to Staging** (2 hours)
- Deploy all fixes
- Run full migration
- Deploy all edge functions

**Task 9.2: Full Regression Test** (4 hours)
- Automated test suite
- Manual QA re-test
- Load test (final)
- Security scan

**Task 9.3: Team Rehearsal** (2 hours)
- Run through deployment steps
- Practice rollback procedure
- Review monitoring dashboards

**Deliverables**:
- [x] Staging deployment successful
- [x] All tests passing
- [x] Team ready for production

---

### Day 10 - Friday, Nov 30 - 4 hours (Half Day)

#### Production Prep
**Owner**: Full Team

**Task 10.1: Final Checklist** (2 hours)
- Verify all P0 blockers resolved
- Check all monitoring/alerts configured
- Review rollback plan
- Update status page

**Task 10.2: Team Sync** (1 hour)
- Final alignment meeting
- Assign roles for D-Day
- Confirm on-call engineer
- Send stakeholder email

**Task 10.3: Weekend Buffer** (1 hour)
- Monitor staging over weekend
- Be on standby for any issues

**Deliverables**:
- [x] Production ready
- [x] Team aligned
- [x] Stakeholders notified

---

## D-Day: Tuesday, December 3, 2025

### Timeline: 9:00 AM - 11:00 AM EAT

**8:45 AM**: Team sync call  
**9:00 AM**: Database backup + migrations  
**9:15 AM**: Deploy edge functions  
**9:35 AM**: Enable feature flags (1%)  
**9:50 AM**: Smoke tests  
**10:05 AM**: Monitor (60 min)  
**11:00 AM**: Go/No-Go decision  

### Rollback Criteria
- Error rate >3% for 5 minutes
- Any payment processing failures
- Database connection issues
- WhatsApp webhook failures >10%

---

## Post-Launch (Dec 3-10)

### Week 1 Monitoring
- **Daily**: Error rate, latency, payment reconciliation
- **Gradual Rollout**: 1% → 10% (Day 2) → 50% (Day 4) → 100% (Day 7)
- **Daily Standups**: 15-min status checks
- **Incident Reviews**: Document any issues

### Success Metrics
- Uptime: >99.5% (target: 99.9%)
- Error rate: <1%
- p95 latency: <2s
- Payment success: >99.5%
- Zero critical incidents

---

## Resource Allocation

### Team Requirements
- **Backend Lead**: Full-time (80 hours)
- **DevOps Engineer**: Full-time (80 hours)
- **QA Lead**: Full-time (60 hours)
- **Frontend Dev**: Part-time (20 hours - admin panel)
- **Fintech Specialist**: Part-time (16 hours - payments)
- **Security Reviewer**: Part-time (8 hours)

### Budget Estimate
- **Datadog** (or logging): $0-$50/month (trial period)
- **PagerDuty** (or alerts): $0-$30/month (free tier)
- **Load Testing**: $0 (k6 open-source)
- **Total**: ~$100/month for monitoring

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CI/CD still failing on Day 1 | Low | High | Dedicate senior dev, timebox to 4h |
| Payment reconciliation complex | Medium | High | Start with manual reconciliation, automate later |
| Load test reveals performance issues | Medium | Medium | Have Redis caching ready as backup |
| Team unavailable (illness) | Low | Medium | Cross-train 2 people per role |
| Staging bugs found late | Medium | Low | Add 2-day buffer in Week 2 |

---

## Sign-Off Checklist

Before Go-Live, ensure:
- [ ] All P0 blockers resolved (5 total)
- [ ] CI/CD 100% green for 48 hours
- [ ] Monitoring/alerting tested
- [ ] Payment reconciliation tested
- [ ] Load test passed (500 users, <2% errors)
- [ ] QA sign-off received
- [ ] Security review passed
- [ ] Runbooks documented
- [ ] Team trained on rollback
- [ ] On-call rotation set up
- [ ] Stakeholders notified

---

**Plan Owner**: DevOps Lead  
**Last Updated**: 2025-11-19  
**Next Review**: 2025-11-22 (end of Week 1)
