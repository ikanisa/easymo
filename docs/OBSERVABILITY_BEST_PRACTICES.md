# Observability Best Practices

**Last Updated**: 2025-11-27  
**Status**: Production Standard  
**Compliance Requirement**: Mandatory for all services

## Overview

All EasyMO services MUST follow these observability practices to ensure:
- Distributed tracing across microservices
- Effective debugging and troubleshooting
- Performance monitoring and optimization
- Security audit trails

## 🎯 Core Requirements

### 1. Structured Logging

**Required**: All services must use structured logging (JSON format)

#### Deno/Edge Functions
```typescript
import { logStructuredEvent } from "../_shared/observability.ts";

// Good ✅
await logStructuredEvent("USER_CREATED", {
  userId: user.id,
  method: "whatsapp",
  correlationId,
});

// Bad ❌
console.log("User created:", user.id);
```

#### Node.js Services
```typescript
import { childLogger } from "@easymo/commons";

const log = childLogger({ service: "wallet-service" });

// Good ✅
log.info({ userId, amount, txId }, "Payment processed");

// Bad ❌
console.log("Payment processed", userId, amount);
```

### 2. Correlation IDs

**Required**: All requests must have correlation IDs for distributed tracing

#### Edge Functions
```typescript
import { withCorrelationId } from "../_shared/middleware/correlation.ts";

Deno.serve(withCorrelationId(async (req, correlationId) => {
  await logStructuredEvent("REQUEST_RECEIVED", {
    correlationId,
    method: req.method,
    path: new URL(req.url).pathname,
  });
  
  // Pass to downstream services
  const response = await fetch(downstreamUrl, {
    headers: {
      "X-Correlation-ID": correlationId,
    },
  });
  
  return new Response("OK");
}));
```

#### Node.js Services
```typescript
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

app.use((req: Request, res: Response, next) => {
  req.correlationId = req.get("x-correlation-id") || uuidv4();
  res.set("X-Correlation-ID", req.correlationId);
  next();
});

// Use in handlers
app.post("/transfer", async (req, res) => {
  const { correlationId } = req;
  log.info({ correlationId, amount: req.body.amount }, "Transfer initiated");
  // ... handler logic
});
```

### 3. PII Masking

**Required**: Mask PII before logging

```typescript
import { maskPII } from "../_shared/observability.ts";

// Good ✅
await logStructuredEvent("USER_LOGIN", {
  phone: maskPII(phoneNumber), // +250 **** ***12
  email: maskPII(email),        // j***@example.com
  correlationId,
});

// Bad ❌
await logStructuredEvent("USER_LOGIN", {
  phone: phoneNumber, // +250 788 123 456 (exposed!)
  email: email,       // john@example.com (exposed!)
});
```

### 4. Event Metrics

**Required**: Record metrics for key events

```typescript
import { recordMetric } from "../_shared/observability.ts";

// Record business events
await recordMetric("user.created", 1, {
  source: "whatsapp",
  country: "RW",
});

await recordMetric("payment.processed", amount, {
  currency: "RWF",
  provider: "momo",
});

await recordMetric("api.latency", latencyMs, {
  endpoint: "/transfer",
  status: "success",
});
```

## 📋 Logging Levels

Use appropriate log levels:

| Level | When to Use | Examples |
|-------|-------------|----------|
| `debug` | Development details, variable values | Request payloads, internal state |
| `info` | Normal operations, key events | User created, payment processed |
| `warn` | Recoverable errors, deprecations | Rate limit warning, fallback used |
| `error` | Unrecoverable errors, failures | Payment failed, service unavailable |

```typescript
log.debug({ payload: req.body }, "Received request");
log.info({ userId }, "User authenticated");
log.warn({ attempts: 3 }, "Rate limit approaching");
log.error({ error: err.message }, "Payment failed");
```

## 🔍 Event Naming Conventions

Use consistent event names:

**Format**: `DOMAIN.ACTION` or `ACTION_RESULT`

```typescript
// Good ✅
USER_CREATED
PAYMENT_PROCESSED
AGENT_MESSAGE_SENT
ORDER_CANCELLED
SESSION_EXPIRED

// Bad ❌
user_made
payment
sent
cancel
expired
```

## 🛡️ Security & Privacy

### PII Masking Implementation

```typescript
export function maskPII(value: string, type: "phone" | "email" | "name" = "phone"): string {
  if (type === "phone") {
    // +250 788 123 456 → +250 **** ***56
    return value.replace(/(\+\d{3})\s?\d{3}\s?\d{3}(\d{2})/, "$1 **** ***$2");
  }
  
  if (type === "email") {
    // john.doe@example.com → j*******@example.com
    const [local, domain] = value.split("@");
    return `${local[0]}${"*".repeat(local.length - 1)}@${domain}`;
  }
  
  if (type === "name") {
    // John Doe → J*** D**
    return value.split(" ").map(part => 
      `${part[0]}${"*".repeat(part.length - 1)}`
    ).join(" ");
  }
  
  return value;
}
```

### Never Log

❌ Passwords (even hashed)  
❌ API keys or secrets  
❌ Full credit card numbers  
❌ Full ID numbers  
❌ Session tokens  
❌ Unmasked phone numbers  
❌ Unmasked email addresses

## 📊 Health Endpoints

All services must expose health endpoints:

```typescript
// Basic health
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Detailed health (with dependencies)
app.get("/health/detailed", async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkDownstreamService(),
  ]);
  
  const healthy = checks.every(c => c.status === "fulfilled");
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    checks: {
      database: checks[0].status,
      redis: checks[1].status,
      downstream: checks[2].status,
    },
    timestamp: new Date().toISOString(),
  });
});
```

## ✅ Compliance Validation

Run the compliance checker:

```bash
# Check all services
pnpm exec tsx scripts/audit/observability-compliance.ts

# Expected output:
# ✅ Compliant: 209/209 (100%)
```

## 🎯 Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Observability compliance | 100% | Measure with audit script |
| Correlation ID coverage | 100% | All requests |
| PII masking coverage | 100% | All user data |
| Structured logging | 100% | No console.log |

## 📚 Examples

### Complete Edge Function Example

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withCorrelationId } from "../_shared/middleware/correlation.ts";
import { logStructuredEvent, maskPII } from "../_shared/observability.ts";

serve(withCorrelationId(async (req, correlationId) => {
  const startTime = Date.now();
  
  try {
    // Log request
    await logStructuredEvent("REQUEST_RECEIVED", {
      correlationId,
      method: req.method,
      path: new URL(req.url).pathname,
    });
    
    const body = await req.json();
    
    // Business logic
    const result = await processRequest(body);
    
    // Log success
    await logStructuredEvent("REQUEST_PROCESSED", {
      correlationId,
      duration: Date.now() - startTime,
      status: "success",
    });
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
    
  } catch (error) {
    // Log error
    await logStructuredEvent("REQUEST_FAILED", {
      correlationId,
      duration: Date.now() - startTime,
      error: error.message,
      stack: error.stack,
    });
    
    return new Response(
      JSON.stringify({ error: "Internal server error", correlationId }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}));
```

### Complete Node.js Service Example

```typescript
import express from "express";
import { childLogger } from "@easymo/commons";
import { v4 as uuidv4 } from "uuid";

const app = express();
const log = childLogger({ service: "wallet-service" });

// Correlation ID middleware
app.use((req, res, next) => {
  req.correlationId = req.get("x-correlation-id") || uuidv4();
  res.set("X-Correlation-ID", req.correlationId);
  next();
});

// Request logging
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on("finish", () => {
    log.info({
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - startTime,
    }, "Request completed");
  });
  
  next();
});

// Business endpoint
app.post("/transfer", async (req, res) => {
  const { correlationId } = req;
  const { amount, recipientPhone } = req.body;
  
  try {
    log.info({
      correlationId,
      amount,
      recipient: maskPII(recipientPhone, "phone"),
    }, "Transfer initiated");
    
    const result = await processTransfer({ amount, recipientPhone });
    
    log.info({
      correlationId,
      txId: result.txId,
      status: "success",
    }, "Transfer completed");
    
    res.json(result);
    
  } catch (error) {
    log.error({
      correlationId,
      error: error.message,
      stack: error.stack,
    }, "Transfer failed");
    
    res.status(500).json({
      error: "Transfer failed",
      correlationId,
    });
  }
});

app.listen(3000, () => {
  log.info({ port: 3000 }, "Wallet service started");
});
```

## 🚀 Migration Guide

For existing services:

1. **Replace console.log**
   ```bash
   ./scripts/maintenance/replace-console-logs.sh --dry-run
   ./scripts/maintenance/replace-console-logs.sh
   ```

2. **Add correlation middleware**
   - Import `withCorrelationId` for edge functions
   - Add Express middleware for Node.js services

3. **Mask PII**
   - Identify all user data logging
   - Apply maskPII before logging

4. **Verify compliance**
   ```bash
   pnpm exec tsx scripts/audit/observability-compliance.ts
   ```

## 📞 Support

Questions about observability? Contact:
- **Team Lead**: @devops-team
- **Documentation**: docs/GROUND_RULES.md
- **Audit Script**: scripts/audit/observability-compliance.ts

---

**Remember**: Observability is not optional. It's essential for production readiness.
