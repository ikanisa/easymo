# Phase 5: Observability Configuration Guide

## ✅ Already Implemented

Sentry and PostHog are **already integrated** in `_shared/observability/logger.ts`!

### Features Available:
- ✅ Sentry error tracking with PII scrubbing
- ✅ PostHog analytics integration
- ✅ Automatic sampling (20% traces, 10% profiles in production)
- ✅ Environment-aware configuration
- ✅ Correlation ID tracking

---

## Configuration Steps

### 1. Set Supabase Secrets

```bash
# Set Sentry DSN
supabase secrets set SENTRY_DSN_SUPABASE="https://YOUR_KEY@YOUR_PROJECT.ingest.sentry.io/YOUR_ID" --project-ref lhbowpbcpwoiparwnwgt

# Set PostHog API Key
supabase secrets set POSTHOG_API_KEY="phc_YOUR_POSTHOG_API_KEY" --project-ref lhbowpbcpwoiparwnwgt

# Optional: Custom PostHog host
supabase secrets set POSTHOG_HOST="https://app.posthog.com" --project-ref lhbowpbcpwoiparwnwgt

# Optional: Adjust sampling rates
supabase secrets set SENTRY_TRACES_SAMPLE_RATE="0.2" --project-ref lhbowpbcpwoiparwnwgt
supabase secrets set SENTRY_PROFILES_SAMPLE_RATE="0.1" --project-ref lhbowpbcpwoiparwnwgt

# Set environment
supabase secrets set APP_ENV="production" --project-ref lhbowpbcpwoiparwnwgt
```

### 2. Get Sentry DSN

1. Go to https://sentry.io
2. Create/select project
3. Go to Settings → Projects → Your Project → Client Keys (DSN)
4. Copy the DSN

### 3. Get PostHog API Key

1. Go to https://app.posthog.com
2. Project Settings → Project API Key
3. Copy the API key

### 4. Verify Configuration

```bash
# Check secrets are set
supabase secrets list --project-ref lhbowpbcpwoiparwnwgt

# Trigger test error to verify Sentry
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-mobility \
  -H "Content-Type: application/json" \
  -d '{"test":"invalid_data"}'

# Check Sentry dashboard - should see error captured
```

---

## Usage in Webhook Functions

Already implemented and active! No code changes needed.

### Automatic Features:

**Error Tracking:**
```typescript
// Errors are automatically captured
try {
  await someOperation();
} catch (error) {
  // Error is captured in Sentry with:
  // - Service name
  // - Request ID
  // - PII scrubbed
  // - Stack trace
}
```

**Analytics:**
```typescript
// Events are tracked in PostHog
await ctx.track("button_clicked", {
  button_id: id,
  user_locale: ctx.locale
});
```

**Logging:**
```typescript
// All logs include context
logStructuredEvent("USER_ACTION", {
  action: "profile_updated",
  userId: ctx.profileId
}, "info");
```

---

## Monitoring Dashboards

### Sentry Dashboard
- **URL:** https://sentry.io/organizations/YOUR_ORG/projects/
- **View:** Errors, performance, releases
- **Alerts:** Configure in Sentry → Alerts

### PostHog Dashboard  
- **URL:** https://app.posthog.com/project/YOUR_PROJECT
- **View:** Events, funnels, user flows
- **Insights:** Create custom dashboards

---

## Alerting Setup

### Sentry Alerts

1. Go to Sentry → Alerts → Create Alert Rule
2. Create alerts for:
   - Error rate > 5% (15 min window)
   - New issue type discovered
   - Performance p95 > 1000ms

### PostHog Alerts

1. Go to PostHog → Insights → Create Insight
2. Create metrics for:
   - User drop-off rate > 30%
   - Button click success rate < 95%
   - API errors per hour > 10

---

## PII Scrubbing

Already enabled! The following are automatically masked:

- ✅ Email addresses: `jo••@example.com`
- ✅ Phone numbers: `+25••••••89`
- ✅ UUIDs: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- ✅ Long numbers: `12••••••••89`

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN_SUPABASE` | No | - | Sentry project DSN |
| `POSTHOG_API_KEY` | No | - | PostHog API key |
| `POSTHOG_HOST` | No | `https://app.posthog.com` | PostHog host |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.2` (prod), `1` (dev) | Trace sampling |
| `SENTRY_PROFILES_SAMPLE_RATE` | No | `0.1` (prod), `1` (dev) | Profile sampling |
| `APP_ENV` | No | `development` | Environment name |
| `SENTRY_RELEASE` | No | - | Release version |

---

## Testing

```bash
# Test Sentry integration
export SENTRY_DSN_SUPABASE="your-dsn"
supabase functions serve wa-webhook-mobility

# Send test request
curl -X POST http://localhost:54321/functions/v1/wa-webhook-mobility \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"invalid"}]}}]}]}'

# Check Sentry dashboard for error
```

---

## Status

- ✅ Sentry integration: **Complete**
- ✅ PostHog integration: **Complete**
- ✅ PII scrubbing: **Complete**
- ✅ Sampling configuration: **Complete**
- ⏳ Secrets configuration: **Needs credentials**
- ⏳ Dashboard setup: **Needs project setup**

**Next Steps:** Set secrets in Supabase, verify in dashboards

---

**Phase 5: COMPLETE (Code-wise)**  
**Deployment:** Requires Sentry + PostHog credentials only
