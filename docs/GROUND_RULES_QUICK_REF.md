# Ground Rules Quick Reference

This is a quick reference for developers. See [GROUND_RULES.md](GROUND_RULES.md) for complete documentation.

## Observability Checklist

When creating new APIs or edge functions:

- [ ] Use `logRequest()` at the start of request handling
- [ ] Use `logResponse()` when completing requests
- [ ] Log significant events with `logStructuredEvent()`
- [ ] Record metrics with `recordMetric()` for counters
- [ ] Record duration with `recordDurationMetric()` for timings
- [ ] Mask PII using `maskPII()` before logging
- [ ] Include correlation IDs in all logs
- [ ] Use structured JSON logging (never plain strings)

### Edge Function Example

```typescript
import { logRequest, logResponse, logStructuredEvent, recordMetric } from "../_shared/observability.ts";

Deno.serve(async (req) => {
  const startTime = Date.now();
  const correlationId = logRequest("my-endpoint", req);
  
  try {
    // Your logic here
    await logStructuredEvent("ACTION_COMPLETED", { correlationId });
    await recordMetric("action.success", 1);
    
    // Record duration of the request
    await recordDurationMetric("request.duration", startTime, {
      endpoint: "my-endpoint"
    });
    
    logResponse("my-endpoint", 200, { correlationId });
    return json({ ok: true });
  } catch (error) {
    logError("my-endpoint", error, { correlationId });
    logResponse("my-endpoint", 500);
    return json({ error: "failed" }, 500);
  }
});
```

## Security Checklist

- [ ] No secrets in client-side code (validated by `prebuild` script)
- [ ] Use `validateRequiredEnvVars()` to check for required secrets
- [ ] Verify webhook signatures with `verifyWhatsAppSignature()` or `verifyHmacSignature()`
- [ ] Use `requireAdminAuth()` to protect admin endpoints
- [ ] Sanitize errors with `sanitizeErrorMessage()` before sending to clients
- [ ] Mask all PII in logs
- [ ] Use constant-time comparison for sensitive values

### Secret Management

```bash
# ✅ CORRECT: Server-side only
SUPABASE_SERVICE_ROLE_KEY=secret
ADMIN_TOKEN=secret

# ✅ CORRECT: Public values
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-key

# ❌ WRONG: Never prefix secrets with NEXT_PUBLIC_ or VITE_
NEXT_PUBLIC_SERVICE_ROLE_KEY=secret  # WRONG!
```

### Webhook Verification

```typescript
import { verifyWhatsAppSignature } from "../_shared/security.ts";

const signature = req.headers.get("x-hub-signature-256");
const rawBody = await req.text();
await verifyWhatsAppSignature(signature, rawBody, Deno.env.get("WA_APP_SECRET"));
```

## Feature Flags Checklist

- [ ] Add flag to `feature-flags.ts` in both edge functions and commons
- [ ] Default to `false` for new features
- [ ] Check flag with `isFeatureEnabled()` before using feature
- [ ] Use `@RequireFeatureFlag()` decorator in NestJS controllers
- [ ] Document flag purpose in code comments
- [ ] Test both enabled and disabled states

### Feature Flag Usage

```typescript
import { isFeatureEnabled } from "../_shared/feature-flags.ts";

// In edge function
if (!isFeatureEnabled("myModule.newFeature")) {
  return json({ error: "feature_not_enabled" }, 403);
}

// In NestJS controller
@Controller("payments")
@UseGuards(FeatureFlagGuard)
export class PaymentsController {
  @Post("collect")
  @RequireFeatureFlag("agent.collectPayment")
  async collect() {
    // Feature implementation
  }
}
```

### Environment Variables

```bash
# Enable feature via environment variable
FEATURE_MYMODULE_NEWFEATURE=true
FEATURE_AGENT_COLLECTPAYMENT=true
```

## Common Patterns

### Structured Event Naming

Use `ENTITY_ACTION` format:
- `USER_CREATED` ✅
- `PAYMENT_PROCESSED` ✅
- `ORDER_FAILED` ✅
- `user created` ❌ (not uppercase with underscore)

### Metric Naming

Use dot notation:
- `user.created` ✅
- `payment.processed` ✅
- `api.duration` ✅

### Correlation IDs

Always include in logs for request tracing:

```typescript
const correlationId = getCorrelationId(req);
logStructuredEvent("EVENT", { correlationId, ...data });
```

### PII Masking

```typescript
import { maskPII } from "../_shared/observability.ts";

const phone = "+250788123456";
// maskPII(value, visibleStart, visibleEnd)
// Keep first 7 chars visible, last 3 chars visible
const masked = maskPII(phone, 7, 3);  // "+250788***456"

logger.info({ 
  event: "USER_ACTION",
  phone: masked  // Always mask before logging
});
```

## Enforcement

These rules are **mandatory**:

- PRs without proper observability will be rejected
- Code reviews verify compliance with ground rules
- CI/CD checks for secret exposure (`prebuild` script)
- Security violations require immediate remediation

## Resources

- Complete documentation: [GROUND_RULES.md](GROUND_RULES.md)
- Example edge function: `supabase/functions/example-ground-rules/index.ts`
- Example middleware: `docs/examples/ground-rules.middleware.ts`
- Test examples: `supabase/functions/_shared/*.test.ts`

## Getting Help

- Review examples in `docs/examples/` and `supabase/functions/example-ground-rules/`
- Check existing edge functions for patterns (e.g., `cart-reminder/index.ts`)
- Ask in development chat for clarification
- Reference utilities source code for detailed JSDoc comments
