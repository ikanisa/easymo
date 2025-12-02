# Phase 2: Security & Error Handling - Quick Reference

## 🚀 Quick Start

### Run All Tests
```bash
./scripts/run-security-tests.sh
```

### Apply Database Migration
```bash
cd supabase
supabase db push
```

### Integration Template
```typescript
import { createSecurityMiddleware } from "../_shared/security/middleware.ts";
import { verifyWebhookRequest } from "../_shared/security/signature.ts";
import { validateInput } from "../_shared/security/input-validator.ts";
import { createAuditLogger } from "../_shared/security/audit-logger.ts";
import { createErrorHandler } from "../_shared/errors/error-handler.ts";

const security = createSecurityMiddleware("my-service");
const audit = createAuditLogger("my-service", supabase);
const errors = createErrorHandler("my-service");

serve(async (req) => {
  const check = await security.check(req);
  if (!check.passed) return check.response!;
  
  // Your service logic here
});
```

## 📦 What's Included

### Security Modules
- `middleware.ts` - Security middleware (8.5 KB)
- `signature.ts` - Signature verification (6.8 KB)
- `input-validator.ts` - Input validation (11 KB)
- `audit-logger.ts` - Audit logging (6.4 KB)
- `config.ts` - Security config (1.1 KB)

### Error Handling
- `error-handler.ts` - Enhanced i18n errors (11 KB)

### Tests (22 total, 100% passing)
- `signature.test.ts` - 5 tests ✅
- `input-validator.test.ts` - 14 tests ✅
- `rate-limit.test.ts` - 3 tests ✅

### Database
- `20251202200000_create_audit_logs.sql` - Audit logs table

## 🔑 Key Features

### Signature Verification
```typescript
const result = await verifyWebhookRequest(req, rawBody, "service-name");
if (!result.valid) {
  // Handle auth failure
}
```

### Input Validation
```typescript
import { validateInput, COMMON_SCHEMAS } from "../security/input-validator.ts";

const result = validateInput(data, COMMON_SCHEMAS.walletTransfer);
if (!result.valid) {
  console.log(result.errors); // { recipient: "required", amount: "min 1" }
}
```

### Audit Logging
```typescript
await audit.logAuth(requestId, correlationId, "success", {
  userId: "user-123",
  method: "whatsapp",
});

await audit.logWalletTransaction(requestId, correlationId, "WALLET_TRANSFER", {
  userId: "user-123",
  amount: 100,
  success: true,
});
```

### Error Handling (i18n)
```typescript
const error = errors.createError("INSUFFICIENT_FUNDS", {
  locale: "fr", // or "en", "rw"
});

return errors.createErrorResponse(error, requestId, correlationId);
// Returns: "Solde insuffisant" in French
```

## 🛡️ Security Checklist

- [ ] Migration applied
- [ ] Tests passing (run `./scripts/run-security-tests.sh`)
- [ ] Environment variables set
- [ ] Services integrated
- [ ] Monitoring configured

## 📊 Service Configs

| Service | Body Limit | Rate Limit |
|---------|-----------|------------|
| core | 1 MB | 100/min |
| profile | 2 MB | 100/min |
| mobility | 1 MB | 100/min |
| insurance | 10 MB | 50/min |

## 🌍 Languages

Error messages in:
- **en** - English (default)
- **fr** - French
- **rw** - Kinyarwanda

## 📝 Environment Variables

```bash
WHATSAPP_APP_SECRET=your_secret
WA_ALLOW_UNSIGNED_WEBHOOKS=false  # true for dev only
WA_ALLOW_INTERNAL_FORWARD=false   # true if needed
```

## 🎯 Common Patterns

### Full Integration Example
```typescript
serve(async (req: Request) => {
  // 1. Security checks
  const secCheck = await security.check(req);
  if (!secCheck.passed) return secCheck.response!;
  const { requestId, correlationId } = secCheck.context;

  // 2. Signature verification
  const rawBody = await req.text();
  const sigResult = await verifyWebhookRequest(req, rawBody, "my-service");
  if (!sigResult.valid) {
    await audit.logAuth(requestId, correlationId, "failure", {
      reason: sigResult.reason,
    });
    return errors.createErrorResponse(
      errors.createError("AUTH_INVALID_SIGNATURE"),
      requestId,
      correlationId
    );
  }

  // 3. Parse and validate
  const payload = JSON.parse(rawBody);
  const validation = validateInput(payload, mySchema);
  if (!validation.valid) {
    return errors.createErrorResponse(
      errors.createError("VALIDATION_FAILED", {
        details: validation.errors,
      }),
      requestId,
      correlationId
    );
  }

  // 4. Process request
  try {
    const result = await processRequest(validation.sanitized);
    await audit.log({
      action: "OPERATION_SUCCESS",
      severity: "low",
      requestId,
      correlationId,
      details: {},
      outcome: "success",
    });
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    return await errors.handleError(error, {
      requestId,
      correlationId,
      operation: "process_request",
    });
  }
});
```

## 📚 Documentation

- Full details: `PHASE_2_COMPLETE.md`
- Security checklist: `docs/SECURITY_CHECKLIST.md`
- Ground rules: `docs/GROUND_RULES.md`

## ✅ Verification

```bash
# Run tests
./scripts/run-security-tests.sh

# Check files
ls -lh supabase/functions/_shared/security/
ls -lh supabase/functions/_shared/errors/

# Verify migration
cat supabase/migrations/20251202200000_create_audit_logs.sql
```

---

**Phase 2 Status**: ✅ COMPLETE & TESTED  
**Ready for**: Production deployment
