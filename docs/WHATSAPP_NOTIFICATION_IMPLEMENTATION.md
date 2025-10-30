# WhatsApp Notification System - Implementation Guide

This guide covers the implementation details of the comprehensive WhatsApp notification system for the EasyMO platform.

## Overview

The notification system consists of:
- **80+ Templates** across 12 domains
- **Policy Enforcement** (quiet hours, opt-out, rate limiting)
- **Smart Retry Logic** with Meta error categorization
- **Observability** with structured logging and metrics
- **Audit Trail** for compliance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Event Triggers                           │
│  (Orders, Baskets, Mobility, OCR, Wallet, etc.)             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              queueNotification()                             │
│  • Validates template                                        │
│  • Enriches with metadata                                    │
│  • Writes to notifications table                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              notifications table                             │
│  • status: queued | sent | failed                            │
│  • retry_count, next_attempt_at                              │
│  • domain, campaign_id, correlation_id                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         notification-worker (Cron + HTTP)                    │
│  • Runs every minute (cron)                                  │
│  • Claims up to 20 notifications                             │
│  • Applies filters per notification                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         processNotificationWithFilters()                     │
│  1. Opt-out check → BLOCK if opted out                       │
│  2. Quiet hours check → DEFER if in quiet hours              │
│  3. Rate limit check → WARN if over limit                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ (if allowed)
┌─────────────────────────────────────────────────────────────┐
│         deliverNotification()                                │
│  • POST to WhatsApp Cloud API                                │
│  • Retry on transient errors                                 │
│  • Extract Meta error codes                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
┌─────────────────┐    ┌──────────────────────┐
│   SUCCESS       │    │   FAILURE            │
│ • Mark sent     │    │ • Categorize error   │
│ • Log metrics   │    │ • Calculate backoff  │
│ • Audit log     │    │ • Retry or fail      │
└─────────────────┘    └──────────────────────┘
```

## Database Schema

### notifications (enhanced)

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  to_wa_id text NOT NULL,
  template_name text,
  notification_type text NOT NULL,
  channel notification_channel DEFAULT 'template',
  status notification_status DEFAULT 'queued',
  payload jsonb DEFAULT '{}',
  
  -- Enhanced fields
  campaign_id uuid,
  correlation_id text,
  domain text,
  quiet_hours_override boolean DEFAULT false,
  last_error_code text,
  
  -- Retry management
  retry_count integer DEFAULT 0,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  
  -- Metadata
  order_id uuid REFERENCES orders(id),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### whatsapp_templates

```sql
CREATE TABLE whatsapp_templates (
  id uuid PRIMARY KEY,
  template_key text UNIQUE NOT NULL,
  template_name text NOT NULL,
  domain text NOT NULL,
  category text NOT NULL,
  description text,
  locale text DEFAULT 'en',
  variables jsonb DEFAULT '[]',
  meta_template_id text,
  approval_status text DEFAULT 'pending',
  is_active boolean DEFAULT true,
  retry_policy jsonb DEFAULT '{"max_retries": 5, "backoff_base_seconds": 30}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### contact_preferences

```sql
CREATE TABLE contact_preferences (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  wa_id text UNIQUE NOT NULL,
  preferred_locale text DEFAULT 'en',
  opted_out boolean DEFAULT false,
  opt_out_at timestamptz,
  opt_out_reason text,
  consent_topics jsonb DEFAULT '[]',
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text DEFAULT 'Africa/Kigali',
  notification_preferences jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### notification_audit_log

```sql
CREATE TABLE notification_audit_log (
  id uuid PRIMARY KEY,
  notification_id uuid REFERENCES notifications(id),
  event_type text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

## Helper Functions

### is_opted_out(wa_id)
Checks if contact has opted out of notifications.

```sql
SELECT is_opted_out('+250788123456');
-- Returns: boolean
```

### is_in_quiet_hours(wa_id, check_time)
Checks if current time is within contact's quiet hours.

```sql
SELECT is_in_quiet_hours('+250788123456', NOW());
-- Returns: boolean
```

### get_contact_locale(wa_id, fallback)
Gets preferred locale with fallback.

```sql
SELECT get_contact_locale('+250788123456', 'en');
-- Returns: text (e.g., 'rw', 'fr', 'en')
```

### calculate_next_retry(retry_count, base_seconds, max_seconds)
Calculates next retry time with exponential backoff and jitter.

```sql
SELECT calculate_next_retry(2, 30, 900);
-- Returns: timestamptz (e.g., now + 120s + jitter)
```

### init_contact_preferences(wa_id, profile_id, locale)
Initializes contact preferences with defaults.

```sql
SELECT init_contact_preferences('+250788123456', 'uuid-here', 'en');
-- Returns: uuid (preference_id)
```

### mark_opted_out(wa_id, reason)
Marks contact as opted out.

```sql
SELECT mark_opted_out('+250788123456', 'user_request');
-- Returns: boolean
```

## Usage Examples

### 1. Queue a Simple Notification

```typescript
import { queueNotification } from "../wa-webhook/notify/sender.ts";

await queueNotification({
  to: "+250788123456",
  template: {
    name: "baskets_payment_confirmed",
    language: "en",
    components: [{
      type: "body",
      parameters: [
        { type: "text", text: "Amahoro SACCO" },
        { type: "text", text: "5,000 RWF" },
        { type: "text", text: "25,000 RWF" }
      ]
    }]
  }
}, {
  type: "baskets_payment_received",
  domain: "baskets",
  correlation_id: "payment_xyz123"
});
```

### 2. Queue with Quiet Hours Override

```typescript
await queueNotification({
  to: contact.wa_id,
  template: emergencyTemplate
}, {
  type: "emergency_alert",
  domain: "core",
  quiet_hours_override: true,  // Skip quiet hours for critical alert
  correlation_id: `incident_${incidentId}`
});
```

### 3. Queue with Delay

```typescript
await queueNotification({
  to: user.wa_id,
  template: reminderTemplate
}, {
  type: "ride_reminder",
  domain: "mobility",
  delaySeconds: 1800,  // Send in 30 minutes
  correlation_id: `ride_${rideId}`
});
```

### 4. Bulk Queue (Campaign)

```typescript
const campaignId = crypto.randomUUID();

for (const member of members) {
  await queueNotification({
    to: member.wa_id,
    template: campaignTemplate
  }, {
    type: "campaign_announcement",
    domain: "baskets",
    campaign_id: campaignId,
    correlation_id: `campaign_${campaignId}_${member.id}`
  });
}
```

### 5. Initialize Contact Preferences

```typescript
await supabase.rpc("init_contact_preferences", {
  p_wa_id: "+250788123456",
  p_profile_id: userId,
  p_locale: "rw"  // Kinyarwanda
});
```

### 6. Handle Opt-Out

```typescript
// When user sends "STOP" or "UNSUBSCRIBE"
await supabase.rpc("mark_opted_out", {
  p_wa_id: userWaId,
  p_reason: "user_request"
});
```

### 7. Check Notification Status

```typescript
const { data } = await supabase
  .from("notifications")
  .select("status, sent_at, error_message, retry_count")
  .eq("correlation_id", "order_123_created")
  .single();

console.log(`Status: ${data.status}, Retries: ${data.retry_count}`);
```

### 8. Get Queue Statistics

```typescript
const { data: stats } = await supabase.rpc("get_notification_queue_stats");

// Returns:
// [
//   { status: 'queued', count: 45, oldest_queued: '2025-10-30T10:00:00Z' },
//   { status: 'sent', count: 1234, oldest_queued: null },
//   { status: 'failed', count: 12, oldest_queued: '2025-10-29T15:30:00Z' }
// ]
```

## Meta Error Code Categorization

The system categorizes Meta/WhatsApp error codes into three strategies:

### 1. RETRY (Transient Errors)
- Network errors
- Temporary API unavailability
- Unknown errors

**Action**: Retry with exponential backoff (30s → 1min → 2min → ...)

### 2. DEFER (Rate Limits)
- **131047**: Rate limit exceeded
- **80007**: Too many requests

**Action**: Longer backoff (5min → 10min → 20min → ...)

### 3. FAIL (Permanent Errors)
- **131000**: Template not found
- **131026**: Template paused
- **131051**: Unsupported message type
- **132000**: Temporary ban
- **133016**: Expired session
- **135000**: Account restricted

**Action**: Mark as failed immediately, no retry

## Observability

### Structured Events

```typescript
// Queued
NOTIFY_QUEUE { id, to, channel, type }

// Sent successfully
NOTIFY_SEND_OK { id, to, message_id }

// Send failed
NOTIFY_SEND_FAIL { id, to, retry, status, error }

// Blocked by opt-out
NOTIFY_BLOCKED_OPTOUT { to }

// Deferred due to quiet hours
NOTIFY_DEFERRED_QUIET_HOURS { to, defer_until }

// Rate limit warning
NOTIFY_RATE_LIMIT_WARNING { id, to, reason }

// Worker lifecycle
NOTIFY_WORKER_START { trigger }
NOTIFY_WORKER_DONE { trigger, processed, duration_ms }
NOTIFY_WORKER_ERROR { trigger, error }
```

### Metrics

```typescript
// Queue depth
notification_queue_depth { trigger: "http" | "cron" }

// Processed count
notification_worker_processed_total { trigger }

// Failures
notification_worker_failures_total { trigger, reason }

// Filtered notifications
notification_filtered_optout { reason: "opted_out" }
notification_filtered_quiet_hours { reason: "quiet_hours" }
notification_filtered_rate_limit { reason: "rate_limited" }

// Delivery metrics
notification_sent { domain, template, error_code: "none" }
notification_failed { domain, template, error_code }
notification_deferred { domain, template, error_code }

// Success rate
notification_success_rate { domain } // 0-100
```

### Alerts

Configure alerts in monitoring system:

- **High Failure Rate**: `notification_success_rate{domain=*} < 80` for 5 minutes
- **Queue Depth**: `notification_queue_depth > 1000` for 5 minutes
- **Worker Down**: No `NOTIFY_WORKER_START` events for 5 minutes
- **Opt-out Spike**: `notification_filtered_optout > 50/hour`
- **Rate Limit Hit**: `notification_deferred{error_code="131047"} > 10/minute`

## Configuration

### Environment Variables

```bash
# WhatsApp API (required)
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v20.0
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=your_access_token

# Template settings
WHATSAPP_TEMPLATE_DEFAULT_LANGUAGE=en
WHATSAPP_TEMPLATE_NAMESPACE=your_namespace

# Notification worker
NOTIFICATION_WORKER_CRON_ENABLED=true
NOTIFY_MAX_RETRIES=5
NOTIFY_BACKOFF_BASE_SECONDS=30
NOTIFY_MAX_BACKOFF_SECONDS=900
NOTIFY_DEFAULT_DELAY_SECONDS=0

# HTTP retry settings
WA_HTTP_STATUS_RETRIES=2
WA_HTTP_STATUS_RETRY_DELAY_MS=400

# Testing
TEST_CUSTOMER_WA_ID=+250788999001
TEST_VENDOR_WA_ID=+250788999002
```

### Supabase Dashboard

1. **Enable Cron**: Navigate to Edge Functions → notification-worker → Settings
   - Set `NOTIFICATION_WORKER_CRON_ENABLED=true`
   - Verify cron schedule: `*/1 * * * *` (every minute)

2. **Grant Permissions**: Ensure service role has access to:
   - `notifications` table
   - `whatsapp_templates` table
   - `contact_preferences` table
   - `notification_audit_log` table
   - Helper functions in `public` schema

## Testing

### 1. Unit Tests (Edge Functions)

```bash
cd supabase/functions
deno test --allow-env --allow-net
```

### 2. Integration Tests

```typescript
// Test notification queue
const { id } = await queueNotification({
  to: TEST_CUSTOMER_WA_ID,
  template: { name: "welcome_message", language: "en" }
}, { type: "test" });

// Verify in notifications table
const { data } = await supabase
  .from("notifications")
  .select("*")
  .eq("id", id)
  .single();

assert(data.status === "queued");

// Trigger worker manually
await fetch(`${SUPABASE_URL}/functions/v1/notification-worker`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
});

// Check status updated
const { data: updated } = await supabase
  .from("notifications")
  .select("status, sent_at")
  .eq("id", id)
  .single();

assert(updated.status === "sent" || updated.status === "failed");
```

### 3. Sandbox Testing

Use Meta's test numbers:
```bash
TEST_CUSTOMER_WA_ID=+250788999001
TEST_VENDOR_WA_ID=+250788999002
```

Send test notifications through admin UI or API.

## Troubleshooting

### Notifications Stuck in Queue

**Check**:
1. Worker cron enabled: `NOTIFICATION_WORKER_CRON_ENABLED=true`
2. Next attempt time: `SELECT next_attempt_at FROM notifications WHERE status = 'queued'`
3. Locked notifications: `SELECT locked_at FROM notifications WHERE locked_at > NOW() - interval '15 minutes'`
4. Opt-out status: `SELECT is_opted_out('+250788123456')`

**Fix**:
```sql
-- Reset stuck locks (older than 15 minutes)
UPDATE notifications
SET locked_at = NULL
WHERE locked_at < NOW() - interval '15 minutes' AND status = 'queued';
```

### High Failure Rate

**Check**:
1. Meta template approval: Check Meta Business Manager
2. Error codes: `SELECT last_error_code, COUNT(*) FROM notifications WHERE status = 'failed' GROUP BY last_error_code`
3. API credentials: Verify `WHATSAPP_ACCESS_TOKEN` is valid

**Common Errors**:
- **131000**: Template not approved → Submit for approval in Meta Business Manager
- **131047**: Rate limit → Reduce send rate or increase backoff
- **135000**: Account restricted → Contact Meta support

### Worker Not Running

**Check**:
1. Cron enabled: Check Supabase dashboard → Edge Functions → notification-worker
2. Worker logs: `NOTIFY_WORKER_START`, `NOTIFY_WORKER_DONE` events
3. Network connectivity: Can worker reach WhatsApp API?

**Manual Trigger**:
```bash
curl -X POST \
  ${SUPABASE_URL}/functions/v1/notification-worker \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"
```

### Notifications Not Sending Despite Worker Running

**Check**:
1. Filters: Contact may be opted out or in quiet hours
2. Rate limits: Check `notification_filtered_rate_limit` metric
3. Template exists: `SELECT * FROM whatsapp_templates WHERE template_key = 'your_key' AND is_active = true`

**Debug**:
```sql
-- Check notification details
SELECT 
  id, 
  status, 
  retry_count, 
  error_message,
  last_error_code,
  next_attempt_at
FROM notifications
WHERE correlation_id = 'your_correlation_id';

-- Check contact preferences
SELECT * FROM contact_preferences WHERE wa_id = '+250788123456';

-- Check audit log
SELECT * FROM notification_audit_log 
WHERE notification_id = 'your_notification_id' 
ORDER BY created_at DESC;
```

## Migration Path

### For Existing Notifications

If you have existing notifications in the queue:

```sql
-- Add missing columns to existing notifications
UPDATE notifications
SET 
  domain = CASE 
    WHEN notification_type LIKE 'baskets%' THEN 'baskets'
    WHEN notification_type LIKE 'order%' THEN 'orders'
    WHEN notification_type LIKE 'ride%' THEN 'mobility'
    ELSE 'core'
  END,
  correlation_id = COALESCE(correlation_id, id::text)
WHERE domain IS NULL OR correlation_id IS NULL;

-- Initialize contact preferences for existing contacts
INSERT INTO contact_preferences (wa_id, preferred_locale)
SELECT DISTINCT to_wa_id, 'en'
FROM notifications
ON CONFLICT (wa_id) DO NOTHING;
```

## Security Considerations

1. **PII Masking**: WhatsApp IDs are masked in logs as `+25***56`
2. **Opt-out Enforcement**: Hard block at filter level, defense-in-depth
3. **Rate Limiting**: Prevents abuse, configurable per contact
4. **Audit Trail**: All notification events logged for compliance
5. **RLS Policies**: Service role required for notification access

## Performance

- **Worker Batch Size**: 20 notifications per run (1 minute interval)
- **Throughput**: Up to 1,200 notifications/hour per worker instance
- **Latency**: P99 < 5 seconds from queue to delivery
- **Retry Budget**: 5 attempts with exponential backoff (max 15 minutes)

## Future Enhancements

- [ ] Template approval sync from Meta
- [ ] Redis-based idempotency (replace in-memory)
- [ ] Multi-locale template fallback
- [ ] A/B testing for template variants
- [ ] Notification scheduling (send at specific time)
- [ ] Delivery rate optimization by time of day
- [ ] Webhook callbacks for delivery status

## References

- [WHATSAPP_NOTIFICATIONS_CATALOG.md](./WHATSAPP_NOTIFICATIONS_CATALOG.md) - Template catalog
- [WHATSAPP_FLOWS.md](./WHATSAPP_FLOWS.md) - Baskets flows
- [GROUND_RULES.md](./GROUND_RULES.md) - Observability requirements
- [Meta WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
