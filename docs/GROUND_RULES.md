# EasyMO Development Ground Rules

**ALL code MUST comply with these rules. PRs without compliance will be REJECTED.**

---

## ⛔ PROHIBITED SERVICES (CRITICAL)

**The following third-party services are STRICTLY PROHIBITED. Code using these will be REJECTED.**

| ❌ DO NOT USE | ✅ USE INSTEAD |
|---------------|----------------|
| Twilio WhatsApp API | **WhatsApp Cloud Business API** (direct Meta API) |
| Twilio Voice/SIP | **MTN and telecom direct SIP Trunk connections** |
| MTN MoMo API | **USSD `tel:` mobile money** (direct dial codes) |
| MoMo Collections/Disbursements API | **USSD-based payment flows** |

**Why?** Direct APIs provide: lower cost, lower latency, full control, and simplified East Africa compliance.

See the [complete documentation in README.md](../README.md#-prohibited-services-critical---do-not-use) for code examples.

---

## 1. Observability

### Structured Logging

All services, edge functions, and APIs MUST use structured logging in JSON format with correlation
IDs.

#### Supabase Edge Functions

```typescript
import { logStructuredEvent } from "../_shared/observability.ts";

// Log significant events
await logStructuredEvent("USER_CREATED", {
  userId,
  method: "whatsapp",
  correlationId: req.headers.get("x-correlation-id"),
});

// Log errors with context
await logStructuredEvent("ERROR", {
  error: err.message,
  stack: err.stack,
  context: { userId, action: "transfer" },
  correlationId,
});
```

#### Node.js Services

```typescript
import { childLogger } from "@easymo/commons";

const log = childLogger({ service: "wallet-service" });

// Log significant events
log.info(
  {
    event: "PAYMENT_PROCESSED",
    txId,
    amount,
    correlationId,
  },
  "Payment OK"
);

// Log errors with context
log.error(
  {
    event: "PAYMENT_FAILED",
    error: err.message,
    txId,
    correlationId,
  },
  "Payment processing failed"
);
```

### Event Counters and Metrics

Record metrics for all significant actions:

```typescript
// Supabase Edge Functions
import { recordMetric } from "../_shared/observability.ts";
await recordMetric("user.created", 1, { source: "whatsapp" });
await recordMetric("message.sent", 1, { channel: "whatsapp", type: "template" });

// Node.js Services
import { metrics } from "@easymo/commons";
metrics.increment("wallet.transfer.success", 1, { currency: "USD" });
metrics.gauge("wallet.balance", balance, { accountId });
metrics.histogram("wallet.transfer.duration", durationMs);
```

### Correlation IDs

Every request MUST have a correlation ID for distributed tracing:

```typescript
// Generate correlation ID at entry point
const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

// Pass to all downstream calls
const response = await fetch(url, {
  headers: { "x-correlation-id": correlationId },
});

// Include in all logs
log.info({ correlationId, event: "PROCESSING" }, "Started");
```

### PII Masking

Personal Identifiable Information MUST be masked in logs:

```typescript
// DO NOT log full phone numbers, emails, or sensitive data
log.info({ phone: maskPhone(phoneNumber), event: "USER_LOOKUP" });

// Masking helper
function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{3})\d+(\d{4})/, "$1****$2");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}
```

## 2. Security

### Secret Management

- **NEVER** expose server secrets in client-side environment variables
- Use `VITE_*` or `NEXT_PUBLIC_*` prefix ONLY for public values
- Service role keys, admin tokens, and API secrets MUST stay server-side

```bash
# ✅ CORRECT - Public values only
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# ❌ WRONG - Server secrets with public prefix
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # NEVER DO THIS
VITE_ADMIN_TOKEN=secret123  # NEVER DO THIS
```

The prebuild script (`scripts/assert-no-service-role-in-client.mjs`) enforces this rule.

### Webhook Signature Verification

ALL webhook endpoints MUST verify signatures:

#### WhatsApp Cloud Business API Webhooks

```typescript
import { verifySignature } from "../wa/verify.ts";

const isValid = await verifySignature(req, rawBody);
if (!isValid) {
  return new Response("Unauthorized", { status: 401 });
}
```

#### SIP Trunk Webhooks (MTN and Telecoms)

```typescript
import crypto from "crypto";

function verifySIPWebhookSignature(
  secretKey: string,
  signature: string,
  body: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

> ⚠️ **IMPORTANT:** Do NOT implement Twilio webhook verification. EasyMO does NOT use Twilio.
> See the [Prohibited Services section in README.md](../README.md#-prohibited-services-critical---do-not-use) for details.

### Rate Limiting

Public endpoints MUST implement rate limiting:

```typescript
// Express middleware
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP",
});

app.use("/api/", limiter);
```

```typescript
// Supabase Edge Function with Upstash Redis
import { Redis } from "@upstash/redis";

async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const redis = new Redis({
    url: Deno.env.get("UPSTASH_REDIS_URL")!,
    token: Deno.env.get("UPSTASH_REDIS_TOKEN")!,
  });

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSec);
  }

  return current <= limit;
}

// Usage
const allowed = await rateLimit(`ratelimit:${userId}`, 10, 60);
if (!allowed) {
  return new Response("Rate limit exceeded", { status: 429 });
}
```

### SQL Injection Prevention

Always use parameterized queries:

```typescript
// ✅ CORRECT - Parameterized query
const { data } = await supabase.from("users").select("*").eq("id", userId);

// ✅ CORRECT - Prisma (automatically parameterized)
const user = await prisma.user.findUnique({ where: { id: userId } });

// ❌ WRONG - String concatenation
const query = `SELECT * FROM users WHERE id = '${userId}'`;
```

### API Key Rotation

Document and implement API key rotation procedures:

1. Generate new key
2. Update services to accept both old and new keys (grace period)
3. Update all clients to use new key
4. Remove old key after grace period

## 3. Feature Flags

All new features MUST be gated behind feature flags that default to OFF in production.

### Implementation

```typescript
// Environment variable
const enableMarketplace = process.env.FEATURE_MARKETPLACE === "true";

// Commons helper
import { isFeatureEnabled } from "@easymo/commons";

if (isFeatureEnabled("wallet.service")) {
  // New feature code
} else {
  // Fallback or error
  return res.status(403).json({ error: "Feature not enabled" });
}
```

### Configuration

```bash
# .env.example
# Feature flags (default: false in production)
FEATURE_MARKETPLACE=false
FEATURE_VOICE_CALLS=false
FEATURE_VIDEO_CALLS=false
FEATURE_AI_AGENTS=false
```

### Testing

Test both enabled and disabled states:

```typescript
describe("Wallet Transfer", () => {
  it("should process when feature enabled", async () => {
    process.env.FEATURE_WALLET_SERVICE = "true";
    // Test enabled behavior
  });

  it("should reject when feature disabled", async () => {
    process.env.FEATURE_WALLET_SERVICE = "false";
    // Test disabled behavior
  });
});
```

## 4. Error Handling

### Fail Fast

Validate configuration at startup:

```typescript
// Check required environment variables
const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_TOKEN"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

### Graceful Degradation

Handle external service failures gracefully:

```typescript
try {
  const result = await externalAPI.call();
  return result;
} catch (error) {
  log.error({ error: error.message, service: "external-api" }, "API call failed");
  // Return cached data or fallback
  return getCachedData() || { error: "Service temporarily unavailable" };
}
```

### Circuit Breaker

Implement circuit breakers for external services:

```typescript
import CircuitBreaker from "opossum";

const breaker = new CircuitBreaker(apiCall, {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 seconds
});

breaker.fallback(() => ({ error: "Service unavailable" }));
breaker.on("open", () => log.warn("Circuit breaker opened"));

const result = await breaker.fire(params);
```

## 5. Idempotency

Financial operations MUST be idempotent:

```typescript
// Idempotency key in request
interface PaymentRequest {
  amount: number;
  currency: string;
  idempotencyKey: string; // Required for all financial operations
}

// Check if already processed
const existing = await redis.get(`idem:${idempotencyKey}`);
if (existing) {
  return JSON.parse(existing);
}

// Process and cache result
const result = await processPayment(amount);
await redis.setex(
  `idem:${idempotencyKey}`,
  86400, // 24 hours
  JSON.stringify(result)
);
```

## 6. Data Integrity

### Foreign Key Constraints

All relationships MUST have foreign key constraints:

```sql
ALTER TABLE transactions
  ADD CONSTRAINT fk_user
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE CASCADE;
```

### Database Transactions

Use transactions for multi-table operations:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.walletEntry.create({ data: debitEntry });
  await tx.walletEntry.create({ data: creditEntry });
  await tx.walletAccount.update({
    where: { id: sourceId },
    data: { balance: { decrement: amount } },
  });
  await tx.walletAccount.update({
    where: { id: destId },
    data: { balance: { increment: amount } },
  });
});
```

### Audit Trails

Financial tables MUST have audit triggers:

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, old_data, new_data, user_id)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    row_to_json(OLD),
    row_to_json(NEW),
    current_setting('app.user_id', true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 7. Performance

### Database Indexes

High-traffic queries MUST have appropriate indexes:

```sql
-- Frequently queried columns
CREATE INDEX idx_transactions_user_created
  ON transactions(user_id, created_at DESC);

-- Composite indexes for complex queries
CREATE INDEX idx_messages_conversation_timestamp
  ON messages(conversation_id, timestamp DESC);

-- Geospatial queries
CREATE INDEX idx_agents_location_geohash
  ON agents USING btree(location_geohash);
```

### Query Optimization

Monitor and optimize slow queries:

```typescript
// Log slow queries
const start = Date.now();
const result = await query();
const duration = Date.now() - start;

if (duration > 1000) {
  log.warn(
    {
      duration,
      query: "fetch_user_transactions",
      userId,
    },
    "Slow query detected"
  );
}
```

### Caching

Implement caching for frequently accessed data:

```typescript
// Cache with TTL
async function getUser(userId: string) {
  const cacheKey = `user:${userId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  await redis.setex(cacheKey, 300, JSON.stringify(user)); // 5 min TTL

  return user;
}
```

## 8. Testing

### Test Coverage

Aim for 80%+ test coverage for critical paths:

```typescript
// Test financial operations
describe("Wallet Transfer", () => {
  it("should transfer funds between accounts", async () => {
    const result = await walletService.transfer({
      sourceAccountId,
      destinationAccountId,
      amount: 100,
      currency: "USD",
    });

    expect(result.transaction).toBeDefined();
    expect(result.entries).toHaveLength(2);
  });

  it("should prevent overdraft", async () => {
    await expect(
      walletService.transfer({
        sourceAccountId,
        destinationAccountId,
        amount: 999999,
        currency: "USD",
      })
    ).rejects.toThrow("Insufficient funds");
  });
});
```

### Integration Tests

Test external integrations with mocks:

```typescript
// Mock external API
jest.mock("../external-api", () => ({
  sendMessage: jest.fn().mockResolvedValue({ messageId: "123" }),
}));

it("should handle API failures gracefully", async () => {
  externalApi.sendMessage.mockRejectedValue(new Error("API Error"));

  const result = await service.sendNotification();
  expect(result.error).toBe("Service temporarily unavailable");
});
```

## 9. Deployment

### Environment Validation

Validate environment before deployment:

```bash
#!/bin/bash
# scripts/validate-env.sh

required_vars=(
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "DATABASE_URL"
  "REDIS_URL"
  "KAFKA_BROKERS"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set"
    exit 1
  fi
done
```

### Database Migrations

Migrations MUST:

- Be reversible (provide DOWN migration)
- Be wrapped in BEGIN/COMMIT
- Be tested in staging first

```sql
-- migrations/20240101000000_add_indexes.sql
BEGIN;

-- Add indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_created
  ON transactions(user_id, created_at DESC);

-- Revert (if needed): DROP INDEX idx_transactions_user_created;

COMMIT;
```

### Health Checks

All services MUST expose health endpoints:

```typescript
app.get("/health", async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    kafka: await checkKafka(),
  };

  const healthy = Object.values(checks).every((v) => v === true);

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "unhealthy",
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

## Summary

These ground rules ensure:

- **Observability**: Structured logging and metrics for debugging
- **Security**: Protected secrets and verified webhooks
- **Reliability**: Feature flags and graceful degradation
- **Performance**: Optimized queries and caching
- **Quality**: High test coverage and validated deployments

Violations of these rules will result in PR rejection. When in doubt, ask for clarification.
