# Sentry Configuration for easyMO

## Overview
This document outlines the Sentry error tracking configuration for the easyMO production system.

## Environment Variables

Add the following environment variables to your Supabase Edge Functions configuration:

```bash
# Sentry Configuration
SENTRY_DSN=https://YOUR_SENTRY_KEY@YOUR_SENTRY_ORG.ingest.sentry.io/YOUR_PROJECT_ID
RELEASE_VERSION=1.0.0
```

## Sentry Project Setup

### 1. Create Sentry Account
- Sign up at https://sentry.io
- Create a new organization for easyMO

### 2. Create Projects
Create separate projects for different components:
- **easymo-webhooks** - For payment webhooks (MoMo, Revolut)
- **easymo-whatsapp** - For WhatsApp webhook handlers
- **easymo-ai-agents** - For AI agent orchestrator
- **easymo-admin** - For admin panel errors

### 3. Configure Alert Rules

#### Critical Alerts (Immediate Notification)
- **Payment Webhook Failures**
  - Condition: Error rate > 5% in 5 minutes
  - Action: Email + Slack notification
  - Priority: P0

- **Database Connection Errors**
  - Condition: Any occurrence
  - Action: Email + SMS
  - Priority: P0

- **Authentication Failures**
  - Condition: Error rate > 10% in 5 minutes
  - Action: Email notification
  - Priority: P1

#### Warning Alerts (Monitor)
- **Slow Operations**
  - Condition: >50 operations taking >1s in 1 hour
  - Action: Email notification
  - Priority: P2

- **API Rate Limits**
  - Condition: Rate limit errors > 10 in 5 minutes
  - Action: Slack notification
  - Priority: P2

### 4. Integration Setup

#### Slack Integration
1. Go to Sentry Settings → Integrations → Slack
2. Connect your workspace
3. Configure channels:
   - `#alerts-critical` - P0 alerts
   - `#alerts-warnings` - P1/P2 alerts
   - `#errors-general` - All errors

#### Email Notifications
1. Go to Sentry Settings → Notifications
2. Add admin emails:
   - Primary: admin@easymo.rw
   - Secondary: tech@easymo.rw

### 5. Performance Monitoring

Enable performance monitoring for:
- **Transaction Traces**: Track slow operations
- **Database Queries**: Monitor query performance
- **External API Calls**: Track Google Maps, WhatsApp API latency

Configuration:
```typescript
{
  tracesSampleRate: 0.1, // 10% of transactions
  profilesSampleRate: 0.1, // 10% of profiles
}
```

### 6. Release Tracking

Tag releases with version numbers:
```bash
# When deploying
export RELEASE_VERSION="1.0.0"
supabase functions deploy --no-verify-jwt
```

### 7. User Context

Errors automatically include:
- User ID
- Correlation ID
- Endpoint name
- Request metadata

### 8. Breadcrumbs

Automatic breadcrumb tracking for:
- Database queries
- External API calls
- State changes
- User actions

## Monitoring Dashboard

### Key Metrics to Monitor
1. **Error Rate**: Should be <1% for webhooks
2. **Response Time**: P95 should be <500ms
3. **Availability**: Should be >99.9%
4. **Failed Transactions**: Should be <0.1%

### Weekly Review
- Review error trends
- Identify recurring issues
- Update alert thresholds
- Check performance metrics

## Testing Error Tracking

### Manual Test
```bash
# Trigger test error
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/test-error \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Verify in Sentry
1. Check Sentry dashboard
2. Verify error appears within 1 minute
3. Confirm alert notifications sent
4. Review error context and stack trace

## Cost Optimization

### Sample Rates
- Production: 100% errors, 10% transactions
- Staging: 100% errors, 50% transactions
- Development: 100% errors, 100% transactions

### Data Retention
- Errors: 90 days
- Transactions: 30 days
- Attachments: 30 days

## Support Contacts

- Sentry Support: support@sentry.io
- Documentation: https://docs.sentry.io
- Status Page: https://status.sentry.io
