# Production Readiness Quick Start

**For immediate action on critical P0 issues**

## 🚨 Priority Overview

| Task           | Effort | Owner       | Blocker Level |
| -------------- | ------ | ----------- | ------------- |
| Rate Limiting  | 8h     | Backend Dev | P0 - Critical |
| RLS Audit      | 16h    | DB Engineer | P0 - Critical |
| Wallet Tests   | 24h    | Senior Dev  | P0 - Critical |
| Audit Triggers | 8h     | DB Engineer | P0 - Critical |

**Total Effort**: 56 hours (Week 1 of implementation plan)

---

## 🔴 Task 1: Rate Limiting (8 hours)

### Objective

Implement rate limiting on all 80+ edge functions to prevent DDoS and API abuse.

### Quick Implementation

#### Step 1: Create Rate Limit Module (2h)

```bash
cd supabase/functions
mkdir -p _shared/rate-limit
```

Create `_shared/rate-limit/index.ts`:

```typescript
import { Redis } from "@upstash/redis";

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowSeconds: number;
}

export async function checkRateLimit(config: RateLimitConfig) {
  const redis = new Redis({
    url: Deno.env.get("UPSTASH_REDIS_URL")!,
    token: Deno.env.get("UPSTASH_REDIS_TOKEN")!,
  });

  const redisKey = `ratelimit:${config.key}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
  pipeline.zadd(redisKey, { score: now, member: `${now}-${Math.random()}` });
  pipeline.zcard(redisKey);
  pipeline.pexpire(redisKey, windowMs);

  const results = await pipeline.exec();
  const requestCount = results[2] as number;

  return {
    allowed: requestCount <= config.limit,
    remaining: Math.max(0, config.limit - requestCount),
    resetAt: new Date(now + windowMs),
  };
}
```

#### Step 2: Apply to Edge Functions (4h)

For each function (e.g., `wa-webhook-core/index.ts`):

```typescript
import { checkRateLimit } from "../_shared/rate-limit/index.ts";

serve(async (req) => {
  const clientId = req.headers.get("x-wamid") || req.headers.get("x-forwarded-for") || "anonymous";

  const rateLimitResult = await checkRateLimit({
    key: `wa-webhook:${clientId}`,
    limit: 100,
    windowSeconds: 60,
  });

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "Retry-After": "60",
        },
      }
    );
  }

  // Continue with existing logic...
});
```

#### Step 3: Test & Verify (2h)

```bash
# Create verification script
cat > scripts/verify/rate-limiting.sh << 'EOF'
#!/bin/bash
set -euo pipefail

ENDPOINTS=("wa-webhook-core" "momo-webhook" "agent-chat")

for endpoint in "${ENDPOINTS[@]}"; do
  echo "Testing $endpoint..."
  for i in {1..150}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" \
      "$SUPABASE_URL/functions/v1/$endpoint" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY")
    if [ "$response" == "429" ]; then
      echo "✅ Rate limit working at request $i"
      break
    fi
  done
done
EOF

chmod +x scripts/verify/rate-limiting.sh
./scripts/verify/rate-limiting.sh
```

### Deliverables

- [ ] Rate limit module created
- [ ] Applied to all 80+ edge functions
- [ ] Verification script passing
- [ ] Metrics logged

---

## 🔴 Task 2: RLS Audit (16 hours)

### Objective

Ensure all tables have Row Level Security enabled with proper policies.

### Quick Implementation

#### Step 1: Run Audit Query (2h)

```bash
# Create audit script
cat > scripts/sql/rls-audit.sql << 'EOF'
-- Find tables without RLS
SELECT
  schemaname,
  tablename,
  'NO RLS ENABLED' as issue
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
  )
ORDER BY tablename;

-- Find tables with RLS but no policies
SELECT
  c.relname as tablename,
  'RLS ENABLED BUT NO POLICIES' as issue
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = c.relname
  );
EOF

# Run audit
psql "$DATABASE_URL" -f scripts/sql/rls-audit.sql
```

#### Step 2: Apply RLS Policies (10h)

```bash
cat > scripts/sql/rls-policies.sql << 'EOF'
-- Wallet Accounts
ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet"
  ON wallet_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages all"
  ON wallet_accounts FOR ALL
  USING (auth.role() = 'service_role');

-- Wallet Entries
ALTER TABLE wallet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own entries"
  ON wallet_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wallet_accounts wa
      WHERE wa.id = wallet_entries.account_id
        AND wa.user_id = auth.uid()
    )
  );

-- Repeat for all financial tables...
EOF

psql "$DATABASE_URL" -f scripts/sql/rls-policies.sql
```

#### Step 3: Create GitHub Action (2h)

```yaml
# .github/workflows/rls-audit.yml
name: RLS Security Audit

on:
  pull_request:
    paths: ["supabase/migrations/**"]
  schedule:
    - cron: "0 6 * * 1" # Weekly

jobs:
  rls-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: psql "$DATABASE_URL" -f scripts/sql/rls-audit.sql
```

#### Step 4: Document (2h)

Create `docs/security/RLS_POLICIES.md` documenting all policies.

### Deliverables

- [ ] RLS audit script created
- [ ] All financial tables have RLS + policies
- [ ] Weekly audit action added
- [ ] Documentation complete

---

## 🔴 Task 3: Wallet Service Tests (24 hours)

### Objective

Achieve 80%+ test coverage on wallet-service with comprehensive test cases.

### Critical Test Cases

#### Setup (2h)

```bash
cd services/wallet-service
pnpm install
pnpm add -D vitest @vitest/coverage-v8
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        "src/transfer/**": { statements: 95, branches: 95 },
        "src/balance/**": { statements: 90, branches: 90 },
      },
    },
  },
});
```

#### Transfer Tests (10h)

```typescript
// src/transfer/__tests__/transfer.test.ts
describe("WalletService - Transfer", () => {
  it("should transfer with double-entry bookkeeping", async () => {
    const result = await walletService.transfer({
      sourceAccountId: "src",
      destinationAccountId: "dst",
      amount: 1000,
      currency: "RWF",
      idempotencyKey: "test-1",
    });

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].amount).toBe(-1000);
    expect(result.entries[1].amount).toBe(1000);
  });

  it("should be idempotent", async () => {
    const key = "idempotent-test";
    const r1 = await walletService.transfer({ ...params, idempotencyKey: key });
    const r2 = await walletService.transfer({ ...params, idempotencyKey: key });
    expect(r1.transaction.id).toBe(r2.transaction.id);
  });

  it("should prevent overdraft", async () => {
    await expect(walletService.transfer({ ...params, amount: 999999 })).rejects.toThrow(
      "Insufficient funds"
    );
  });

  it("should handle concurrent transfers", async () => {
    const transfers = Array(10)
      .fill(null)
      .map((_, i) => walletService.transfer({ ...params, idempotencyKey: `concurrent-${i}` }));
    const results = await Promise.allSettled(transfers);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
  });
});
```

#### Balance Tests (6h)

Test balance calculation, consistency checks, reconciliation.

#### Integration Tests (4h)

Test full payment flows end-to-end.

#### Run Coverage (2h)

```bash
pnpm test:coverage
# Target: 80%+ overall, 95%+ on transfer module
```

### Deliverables

- [ ] 95%+ coverage on transfer module
- [ ] 90%+ coverage on balance module
- [ ] Concurrency tests passing
- [ ] Idempotency verified

---

## 🔴 Task 4: Audit Triggers (8 hours)

### Objective

Implement audit log triggers on all financial tables.

### Quick Implementation

#### Step 1: Create Audit Table (2h)

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  user_id TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name, created_at DESC);
```

#### Step 2: Create Trigger Function (2h)

```sql
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  changed_cols TEXT[];
BEGIN
  INSERT INTO audit_log (
    table_name,
    operation,
    old_data,
    new_data,
    user_id,
    correlation_id
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    auth.uid()::TEXT,
    current_setting('app.correlation_id', true)::UUID
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Step 3: Apply to Financial Tables (3h)

```sql
CREATE TRIGGER audit_wallet_accounts
  AFTER INSERT OR UPDATE OR DELETE ON wallet_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_wallet_transactions
  AFTER INSERT OR UPDATE OR DELETE ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Repeat for all 10 financial tables
```

#### Step 4: Verify (1h)

```bash
psql "$DATABASE_URL" << 'EOF'
SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'audit_%';
-- Should return 10 (one per financial table)
EOF
```

### Deliverables

- [ ] Audit log table created
- [ ] Triggers on 10 financial tables
- [ ] Changed field tracking works
- [ ] Correlation ID propagation verified

---

## 📋 Daily Checklist

Run this every day during Week 1:

```bash
#!/bin/bash
# scripts/verify/p0-readiness.sh

echo "=== P0 Readiness Check ==="

# 1. Rate limiting
echo -n "Rate limiting: "
if scripts/verify/rate-limiting.sh &>/dev/null; then
  echo "✅"
else
  echo "❌ FAILED"
fi

# 2. RLS
echo -n "RLS policies: "
rls_count=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'")
if [ "$rls_count" -gt "20" ]; then
  echo "✅ ($rls_count policies)"
else
  echo "❌ Only $rls_count policies"
fi

# 3. Tests
echo -n "Wallet tests: "
cd services/wallet-service
coverage=$(pnpm test:coverage 2>&1 | grep "All files" | awk '{print $4}')
echo "$coverage coverage"

# 4. Audit triggers
echo -n "Audit triggers: "
trigger_count=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'audit_%'")
if [ "$trigger_count" -eq "10" ]; then
  echo "✅ (10/10)"
else
  echo "❌ ($trigger_count/10)"
fi

echo "======================="
```

Make it executable:

```bash
chmod +x scripts/verify/p0-readiness.sh
./scripts/verify/p0-readiness.sh
```

---

## 🎯 Success Criteria

### Week 1 Complete When:

- [ ] Rate limiting active on 80+ edge functions
- [ ] All financial tables have RLS policies
- [ ] Wallet service has ≥80% test coverage
- [ ] 10 audit triggers verified working
- [ ] All P0 verification scripts pass

### Metrics to Track:

- Edge functions with rate limiting: **0/80 → 80/80**
- RLS policies count: **? → 30+**
- Wallet test coverage: **~40% → 80%+**
- Audit triggers: **0/10 → 10/10**

---

## 🆘 Troubleshooting

### Rate Limiting Issues

**Problem**: Redis connection failing  
**Solution**: Verify `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` in env

### RLS Issues

**Problem**: Policies blocking service role  
**Solution**: Add `auth.role() = 'service_role'` bypass policy

### Test Coverage Issues

**Problem**: Cannot reach 80% coverage  
**Solution**: Focus on critical paths first (transfer, balance check)

### Audit Trigger Issues

**Problem**: Triggers not firing  
**Solution**: Check `SECURITY DEFINER` on trigger function

---

## 📞 Escalation

If blocked for >2 hours:

1. Check [AUDIT_REPORT.md](./AUDIT_REPORT.md) for context
2. Review [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for details
3. Post in #engineering-critical Slack channel with:
   - Task number
   - Error message
   - What you've tried

---

## 📚 Resources

- **Full Audit**: [AUDIT_REPORT.md](./AUDIT_REPORT.md)
- **4-Week Plan**: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
- **Ground Rules**: [../GROUND_RULES.md](../GROUND_RULES.md)
- **Architecture**: [../architecture/](../architecture/)

**Next Steps**: After completing P0 tasks, proceed to Phase 2 (DevOps & Infrastructure) in the
Implementation Plan.
