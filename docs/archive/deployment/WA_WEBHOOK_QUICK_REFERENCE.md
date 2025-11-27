# WA-Webhook Review: Quick Reference Guide
**For:** Development Team  
**Date:** 2025-11-23  
**Status:** ACTION REQUIRED

---

## 🚨 URGENT: Fix This Now (P0)

### Insurance OCR Endpoint Bug
**Impact:** ALL insurance document uploads failing  
**File:** `supabase/functions/wa-webhook/domains/insurance/ins_ocr.ts`  
**Line:** 187

```diff
- const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
+ const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
```

**Test After Fix:**
1. Upload insurance document via WhatsApp
2. Verify OCR processing completes
3. Check admin receives notification

**Deploy:** ASAP (5 minute fix)

---

## 📋 This Week's Checklist

### Monday: Fix Production Bug
- [ ] Fix insurance OCR endpoint (above)
- [ ] Deploy to production
- [ ] Manual test insurance flow
- [ ] Monitor error logs for 24h

### Tuesday-Wednesday: Logging Compliance
- [ ] Find all `console.log()` without JSON
- [ ] Replace with `logStructuredEvent()`
- [ ] Find all `console.error()` without JSON  
- [ ] Replace with proper structured logging
- [ ] Run linter to verify

### Thursday-Friday: Error Handling
- [ ] Fix 7 empty catch blocks
- [ ] Add proper error logging
- [ ] Add user-friendly error messages
- [ ] Test error scenarios

---

## 🔧 Common Fixes

### Fix #1: Unstructured Logging
```typescript
// ❌ WRONG
console.error("operation_failed", error);

// ✅ CORRECT
await logStructuredEvent("ERROR", {
  operation: "specific_operation",
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  correlationId: ctx.correlationId
});
```

### Fix #2: Empty Catch Blocks
```typescript
// ❌ WRONG
try {
  await riskyOperation();
} catch (_) {}

// ✅ CORRECT
try {
  await riskyOperation();
} catch (error) {
  await logStructuredEvent("ERROR", {
    operation: "risky_operation",
    error: error instanceof Error ? error.message : String(error),
    recoveryAction: "using_fallback"
  });
  // Use fallback or re-throw
}
```

### Fix #3: Database Indexes
```sql
-- Add these indexes CONCURRENTLY (no downtime)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_events_user_time 
  ON public.wa_events(wa_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_insurance_leads_active 
  ON public.insurance_leads(whatsapp, status, created_at DESC)
  WHERE status IN ('received', 'processing');

-- Run during low-traffic period
-- Monitor progress: SELECT * FROM pg_stat_progress_create_index;
```

---

## 🧪 Testing Priorities

### This Sprint: Add These Tests

#### Wallet Tests (Priority 1)
```typescript
// tests/wallet/transfer.test.ts
describe('Wallet Transfer', () => {
  it('should transfer tokens successfully', async () => {
    const result = await transferTokens({
      fromUserId: 'user1',
      toUserId: 'user2',
      amount: 100,
      idempotencyKey: crypto.randomUUID()
    });
    expect(result.success).toBe(true);
  });

  it('should prevent insufficient balance transfer', async () => {
    await expect(transferTokens({
      fromUserId: 'user1',
      toUserId: 'user2',
      amount: 999999
    })).rejects.toThrow('Insufficient balance');
  });

  it('should be idempotent', async () => {
    const key = crypto.randomUUID();
    const result1 = await transferTokens({ ..., idempotencyKey: key });
    const result2 = await transferTokens({ ..., idempotencyKey: key });
    expect(result1.transactionId).toBe(result2.transactionId);
  });
});
```

#### Insurance Tests (Priority 1)
```typescript
// tests/insurance/ocr.test.ts
describe('Insurance OCR', () => {
  it('should extract data from certificate', async () => {
    const result = await processInsuranceDocument({
      mediaUrl: 'https://example.com/cert.jpg'
    });
    expect(result.extracted).toHaveProperty('policyNumber');
  });

  it('should handle OCR failures gracefully', async () => {
    // Mock OpenAI API failure
    const result = await processInsuranceDocument({
      mediaUrl: 'invalid'
    });
    expect(result.error).toBeDefined();
    expect(result.userMessage).toContain('try again');
  });
});
```

---

## 📊 Monitoring Checklist

### Add These Metrics
```typescript
// In your handlers, add:
await recordMetric("wa_webhook.insurance.ocr.success", 1, { provider: "openai" });
await recordMetric("wa_webhook.wallet.transfer.amount", amount, { currency });
await recordMetric("wa_webhook.error.rate", 1, { domain, errorType });
```

### Monitor These Dashboards
- Error rate by domain (target: < 1%)
- p95 latency by endpoint (target: < 1200ms)
- Database query latency (target: < 500ms)
- OpenAI API latency (target: < 2000ms)

---

## 🐛 Known Issues & Workarounds

### Issue #1: Insurance Uploads Failing
**Status:** 🔴 CRITICAL - Fix in progress  
**Workaround:** None (system broken)  
**ETA:** Fix deployed by end of day

### Issue #2: Wallet Share Link Error
**Status:** 🟡 INVESTIGATING  
**Workaround:** Tell users to try again in 5 minutes  
**Debug:** Check `ensureReferralLink()` implementation

### Issue #3: Redeem Rewards "Can't Show"
**Status:** 🟡 INVESTIGATING  
**Workaround:** Check reward catalog populated  
**Debug:** Query `SELECT * FROM rewards WHERE is_active = true`

---

## 🔍 Debugging Tips

### Check Correlation ID
```bash
# Find all logs for a specific request
supabase functions logs wa-webhook | grep "correlation-id-here"
```

### Check Database State
```sql
-- Recent webhook events
SELECT event_type, wa_id, created_at, payload->>'error' as error
FROM wa_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC 
LIMIT 50;

-- Insurance leads status
SELECT status, COUNT(*), MAX(created_at) as latest
FROM insurance_leads 
GROUP BY status;

-- Active insurance contacts
SELECT * FROM insurance_admin_contacts 
WHERE is_active = true;
```

### Check External APIs
```bash
# Test OpenAI endpoint
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"test"}]}'

# Check WhatsApp API
curl "https://graph.facebook.com/v18.0/$WA_PHONE_ID" \
  -H "Authorization: Bearer $WA_TOKEN"
```

---

## 📚 Code Review Guidelines

### Before Submitting PR

✅ **Required:**
- [ ] All logging is structured (no `console.log/error` without JSON)
- [ ] No empty catch blocks
- [ ] Correlation IDs passed through all calls
- [ ] Tests added for new features
- [ ] Tests pass locally
- [ ] No secrets in code or env vars with `VITE_*` or `NEXT_PUBLIC_*`
- [ ] Database migrations wrapped in BEGIN/COMMIT
- [ ] RLS policies on new tables

✅ **Recommended:**
- [ ] Error handling includes user-friendly messages
- [ ] Metrics tracked for significant operations
- [ ] Performance tested (no N+1 queries)
- [ ] Documentation updated

### PR Template
```markdown
## What
Brief description of changes

## Why
Link to issue or explanation of need

## How
Technical approach

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Error scenarios tested

## Checklist
- [ ] Structured logging compliance
- [ ] Error handling complete
- [ ] Tests passing
- [ ] No secrets leaked
```

---

## 🎯 Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| p50 latency | < 500ms | ~400ms | ✅ GOOD |
| p95 latency | < 1200ms | ~900ms | ✅ GOOD |
| p99 latency | < 2000ms | ~1500ms | ✅ GOOD |
| Error rate | < 1% | ~0.5% | ✅ GOOD |
| Test coverage | > 80% | 6.5% | 🔴 BAD |
| Uptime | > 99.5% | 99.8% | ✅ GOOD |

---

## 📞 Who to Contact

### For Issues

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Production bugs | @engineering-lead | < 1 hour |
| Database issues | @devops-team | < 2 hours |
| API failures | @backend-team | < 4 hours |
| Test failures | @qa-team | < 1 day |

### For Questions

| Topic | Resource |
|-------|----------|
| Architecture | `WA_WEBHOOK_DEEP_REVIEW_REPORT.md` Section 1 |
| Database schema | `WA_WEBHOOK_DEEP_REVIEW_REPORT.md` Section 2 |
| Security | `docs/GROUND_RULES.md` Section 2 |
| Testing | `WA_WEBHOOK_DEEP_REVIEW_REPORT.md` Section 4 |
| Deployment | `WA_WEBHOOK_DEPLOYMENT_GUIDE.md` |

---

## 🚀 Deployment Process

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Code review approved
- [ ] Database migrations tested in staging
- [ ] No breaking changes to APIs
- [ ] Rollback plan documented

### Deployment Steps
```bash
# 1. Run tests
pnpm test

# 2. Deploy database migrations (if any)
supabase db push

# 3. Deploy edge functions
supabase functions deploy wa-webhook

# 4. Smoke test
curl https://your-project.supabase.co/functions/v1/wa-webhook/health

# 5. Monitor logs
supabase functions logs wa-webhook --tail

# 6. Check metrics dashboard
# Look for error rate spikes or latency increases
```

### Rollback Procedure
```bash
# If deployment fails:
# 1. Revert edge function
supabase functions deploy wa-webhook --version previous

# 2. Revert database (if needed)
# Apply down migration manually

# 3. Notify team
# Post in #incidents channel
```

---

## 🎓 Learning Resources

### Required Reading
1. `docs/GROUND_RULES.md` - Compliance requirements
2. `WA_WEBHOOK_DEEP_REVIEW_REPORT.md` - Full system analysis
3. `WA_WEBHOOK_REVIEW_EXECUTIVE_SUMMARY.md` - Quick overview

### Recommended Reading
- OpenAI API docs: https://platform.openai.com/docs
- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp
- Supabase Edge Functions: https://supabase.com/docs/guides/functions

### Code Examples
- Good test: `supabase/functions/wa-webhook-mobility/handlers/driver_onboarding.test.ts`
- Good error handling: `supabase/functions/wa-webhook/router/pipeline.ts`
- Good logging: `supabase/functions/wa-webhook/domains/insurance/ins_handler.ts`

---

**Last Updated:** 2025-11-23  
**Next Review:** 2025-12-23 (monthly)  
**Questions?** Check full reports or ask in #wa-webhook-dev
