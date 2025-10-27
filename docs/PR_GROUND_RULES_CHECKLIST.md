# Pull Request Ground Rules Checklist

Use this checklist when reviewing pull requests to ensure compliance with EasyMO ground rules.

## Observability ✓

**Structured Logging**
- [ ] All API endpoints log requests with `logRequest()` / `logResponse()`
- [ ] Significant events logged with `logStructuredEvent()`
- [ ] All logs use structured JSON format (no plain strings)
- [ ] Correlation IDs included in all logs
- [ ] PII masked using `maskPII()` before logging
- [ ] Error logging includes full context via `logError()`

**Event Counters**
- [ ] Metrics recorded for significant actions using `recordMetric()`
- [ ] Duration tracked for operations using `recordDurationMetric()`
- [ ] Gauge metrics used appropriately for current values
- [ ] Metrics include meaningful dimensions for filtering

**Log Quality**
- [ ] Event names follow `ENTITY_ACTION` pattern (e.g., `USER_CREATED`)
- [ ] Metric names use dot notation (e.g., `user.created`)
- [ ] Appropriate log levels used (error/warn/info/debug)
- [ ] No sensitive data in logs (tokens, passwords, raw PII)
- [ ] Stack traces only exposed in development (not production)

## Security ✓

**Secret Management**
- [ ] No secrets exposed client-side (check `NEXT_PUBLIC_*` and `VITE_*` vars)
- [ ] `prebuild` script passes (validates no service role key in client code)
- [ ] Required environment variables validated with `validateRequiredEnvVars()`
- [ ] No placeholder values (`CHANGEME_*`) in committed code
- [ ] Secrets stored in `.env.local` (gitignored) or deployment config

**Webhook Security**
- [ ] All webhook endpoints verify signatures
- [ ] WhatsApp webhooks use `verifyWhatsAppSignature()`
- [ ] Other webhooks use `verifyHmacSignature()` or equivalent
- [ ] Admin endpoints protected with `requireAdminAuth()`

**Data Protection**
- [ ] PII masked in all logs
- [ ] Error messages sanitized with `sanitizeErrorMessage()` before sending to clients
- [ ] Input validation using Zod schemas
- [ ] No sensitive info leaked in error responses
- [ ] RLS policies defined for new database tables

**Security Headers**
- [ ] Security headers middleware applied (if applicable)
- [ ] CORS configured appropriately
- [ ] Rate limiting considered for public endpoints

## Feature Flags ✓

**Flag Definition**
- [ ] New feature flag added to `feature-flags.ts` (both edge functions and commons)
- [ ] Flag defaults to `false` for new features
- [ ] Flag documented with comment explaining its purpose
- [ ] Environment variable pattern follows `FEATURE_MODULE_CAPABILITY`

**Flag Usage**
- [ ] Feature gated with `isFeatureEnabled()` check
- [ ] NestJS endpoints use `@RequireFeatureFlag()` decorator with guard
- [ ] Feature behavior tested with flag ON and OFF
- [ ] Appropriate error/message returned when feature disabled

**Flag Management**
- [ ] Flag state logged when feature access attempted
- [ ] Metrics recorded for feature access (enabled/disabled)
- [ ] Clear plan for flag removal after feature stabilizes

## Code Quality ✓

**TypeScript**
- [ ] No TypeScript errors
- [ ] Strict mode compliance
- [ ] No `any` types (use proper typing)
- [ ] Interfaces/types properly defined

**Testing**
- [ ] New functionality has tests
- [ ] Tests cover both success and error cases
- [ ] Feature flag states tested (ON/OFF)
- [ ] Existing tests still pass

**Documentation**
- [ ] README updated if public API changes
- [ ] Ground rules examples updated if patterns change
- [ ] JSDoc comments for public functions
- [ ] Environment variables documented in `.env.example`

## Examples Reviewed ✓

**Edge Functions**
- [ ] Follows pattern in `supabase/functions/example-ground-rules/index.ts`
- [ ] Uses shared utilities from `_shared/`
- [ ] Proper error handling with try/catch
- [ ] Returns appropriate HTTP status codes

**Node.js Services**
- [ ] Uses pino logger from `@easymo/commons`
- [ ] Child logger created with service context
- [ ] Middleware applied for request logging (if applicable)
- [ ] Feature flag guard used on protected endpoints

## Common Issues ✓

**Anti-Patterns to Reject**

❌ Unstructured logging (even with proper logger):
```typescript
logger.info("User created");  // WRONG - plain string
logger.info(`User ${userId} created`);  // WRONG - string interpolation
```
✅ Structured logging:
```typescript
logStructuredEvent("USER_CREATED", { userId });  // CORRECT
logger.info({ event: "USER_CREATED", userId });  // CORRECT
```

❌ Secrets in client code:
```bash
NEXT_PUBLIC_SERVICE_ROLE_KEY=secret  # WRONG
```
✅ Server-side only:
```bash
SUPABASE_SERVICE_ROLE_KEY=secret  # CORRECT
```

❌ Unmasked PII:
```typescript
logger.info({ phone: "+250788123456" });  // WRONG
```
✅ Masked PII:
```typescript
logger.info({ phone: maskPII("+250788123456") });  // CORRECT
```

❌ No feature flag:
```typescript
async function newFeature() {
  // New feature code without flag
}
```
✅ Feature flag enforced:
```typescript
async function newFeature() {
  if (!isFeatureEnabled("module.newFeature")) {
    return json({ error: "feature_disabled" }, 403);
  }
  // Feature code
}
```

## Approval Criteria

**Must Pass**:
- All observability requirements met
- All security requirements met
- All feature flags requirements met
- No TypeScript errors
- Tests pass

**Optional** (but recommended):
- Performance considerations addressed
- Error handling comprehensive
- Code is maintainable and well-documented

## Additional Resources

- [GROUND_RULES.md](GROUND_RULES.md) - Complete documentation
- [GROUND_RULES_QUICK_REF.md](GROUND_RULES_QUICK_REF.md) - Quick reference
- `supabase/functions/example-ground-rules/` - Reference implementation
- `docs/examples/ground-rules.middleware.ts` - Middleware examples

## Reviewer Notes

When reviewing:

1. **Don't be lenient** - Ground rules are mandatory, not optional
2. **Provide examples** - Link to correct implementations when rejecting
3. **Educate** - Explain why rules exist (security, debugging, compliance)
4. **Be consistent** - Apply rules equally to all PRs
5. **Check utilities** - Ensure using shared utilities, not reinventing

If rules need updating:
- Update `GROUND_RULES.md` first
- Update examples and tests
- Announce changes in development chat
- Update this checklist
