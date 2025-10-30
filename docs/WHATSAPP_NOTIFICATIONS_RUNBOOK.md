# WhatsApp Notifications - Operational Runbook

Quick reference guide for operating and troubleshooting the WhatsApp notification system.

## Quick Links

- [Catalog](./WHATSAPP_NOTIFICATIONS_CATALOG.md) - All 80+ notification templates
- [Implementation](./WHATSAPP_NOTIFICATION_IMPLEMENTATION.md) - Technical implementation details
- [Flows](./WHATSAPP_FLOWS.md) - Baskets WhatsApp flows

## System Status Check

### 1. Is the notification worker running?

```sql
-- Check for recent worker activity (last 5 minutes)
SELECT 
  event_type,
  details->>'trigger' as trigger,
  details->>'processed' as processed,
  created_at
FROM observability_events
WHERE event_type IN ('NOTIFY_WORKER_START', 'NOTIFY_WORKER_DONE')
  AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 10;
```

Expected: Should see `NOTIFY_WORKER_START` and `NOTIFY_WORKER_DONE` events within last 5 minutes.

### 2. What's the current queue depth?

```sql
SELECT status, COUNT(*), MIN(created_at) as oldest
FROM notifications
GROUP BY status;
```

Expected output:
```
status  | count | oldest
--------|-------|------------------
queued  |    45 | 2025-10-30 10:00
sent    | 12345 | 2025-10-29 08:00
failed  |    12 | 2025-10-30 09:30
```

**Alert if**: `queued` > 1000 or oldest `queued` > 1 hour

### 3. What's the failure rate?

```sql
SELECT 
  domain,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2) as failure_rate_pct
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY domain
ORDER BY failure_rate_pct DESC;
```

**Alert if**: `failure_rate_pct` > 20%

## Common Issues

### Issue: Notifications stuck in queue

**Symptoms**: Growing queue depth, no notifications being sent

**Quick Fix**:
```sql
-- 1. Check if worker is enabled
-- Go to Supabase Dashboard → Edge Functions → notification-worker
-- Ensure NOTIFICATION_WORKER_CRON_ENABLED=true

-- 2. Check for stuck locks
UPDATE notifications
SET locked_at = NULL
WHERE locked_at < NOW() - INTERVAL '15 minutes'
  AND status = 'queued';

-- 3. Manually trigger worker
-- HTTP POST to /functions/v1/notification-worker
```

**Root Cause Investigation**:
```sql
-- Check for deferred notifications
SELECT 
  id,
  to_wa_id,
  notification_type,
  next_attempt_at,
  error_message,
  retry_count
FROM notifications
WHERE status = 'queued'
  AND next_attempt_at > NOW()
ORDER BY next_attempt_at
LIMIT 20;
```

### Issue: High failure rate

**Symptoms**: Many notifications with `status = 'failed'`

**Quick Diagnosis**:
```sql
-- Group failures by error code
SELECT 
  last_error_code,
  COUNT(*) as count,
  MAX(error_message) as example_error
FROM notifications
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY last_error_code
ORDER BY count DESC;
```

**Common Error Codes**:

| Code | Meaning | Fix |
|------|---------|-----|
| 131000 | Template not found | Check template exists in Meta Business Manager and is approved |
| 131047 | Rate limit exceeded | Reduce send rate or wait for rate limit to reset |
| 135000 | Account restricted | Contact Meta support - account may be banned |
| 132000 | Temporary ban | Wait for ban to lift, review message content for policy violations |
| NULL | Network/unknown error | Check WhatsApp API connectivity, verify credentials |

**Quick Fixes by Error Code**:

```sql
-- For 131000 (template not found): Check template status
SELECT template_key, approval_status, is_active
FROM whatsapp_templates
WHERE template_key = 'your_template_key';

-- For 131047 (rate limit): Check send rate
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as sent_count
FROM notifications
WHERE status = 'sent'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- For account issues: Check API credentials
-- Verify WHATSAPP_ACCESS_TOKEN is valid in Supabase Dashboard
```

### Issue: Notifications sending during quiet hours

**Symptoms**: Users complaining about late-night messages

**Diagnosis**:
```sql
-- Check if quiet hours override is being used
SELECT 
  id,
  to_wa_id,
  notification_type,
  quiet_hours_override,
  sent_at
FROM notifications
WHERE status = 'sent'
  AND sent_at > NOW() - INTERVAL '24 hours'
  AND EXTRACT(HOUR FROM sent_at AT TIME ZONE 'Africa/Kigali') BETWEEN 22 AND 6
ORDER BY sent_at DESC;
```

**Fix**:
```sql
-- Ensure contact preferences are set
SELECT wa_id, quiet_hours_start, quiet_hours_end, timezone
FROM contact_preferences
WHERE wa_id = '+250788123456';

-- If missing, initialize:
SELECT init_contact_preferences('+250788123456', NULL, 'en');
```

### Issue: User opted out but still receiving messages

**Symptoms**: User reports receiving messages after opting out

**Diagnosis**:
```sql
-- Check opt-out status
SELECT 
  wa_id,
  opted_out,
  opt_out_at,
  opt_out_reason
FROM contact_preferences
WHERE wa_id = '+250788123456';
```

**Fix**:
```sql
-- Ensure user is opted out
SELECT mark_opted_out('+250788123456', 'user_request');

-- Check for pending notifications
SELECT id, status, notification_type
FROM notifications
WHERE to_wa_id = '+250788123456'
  AND status = 'queued';

-- Cancel pending notifications for opted-out user
UPDATE notifications
SET status = 'failed',
    error_message = 'Contact opted out'
WHERE to_wa_id = '+250788123456'
  AND status = 'queued';
```

### Issue: Template not sending

**Symptoms**: Specific template always fails

**Diagnosis**:
```sql
-- Check template configuration
SELECT *
FROM whatsapp_templates
WHERE template_key = 'tmpl_your_template';

-- Check recent failures
SELECT 
  id,
  error_message,
  last_error_code,
  payload
FROM notifications
WHERE template_name = 'your_template_name'
  AND status = 'failed'
ORDER BY created_at DESC
LIMIT 5;
```

**Quick Fixes**:
1. **Template not approved**: Submit for approval in Meta Business Manager
2. **Template paused**: Unpause in Meta Business Manager
3. **Wrong parameters**: Check `variables` jsonb in `whatsapp_templates` matches what you're sending

## Manual Operations

### Manually send a test notification

```sql
-- Using SQL
SELECT queueNotification(
  jsonb_build_object(
    'to', '+250788999001',  -- Test number
    'template', jsonb_build_object(
      'name', 'welcome_message',
      'language', 'en',
      'components', jsonb_build_array(
        jsonb_build_object(
          'type', 'body',
          'parameters', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', 'Test User')
          )
        )
      )
    )
  ),
  jsonb_build_object(
    'type', 'test',
    'domain', 'core',
    'correlation_id', 'test_' || gen_random_uuid()
  )
);

-- Then trigger worker
-- POST to /functions/v1/notification-worker
```

### Retry failed notifications

```sql
-- Retry all failed notifications from last hour
UPDATE notifications
SET 
  status = 'queued',
  retry_count = 0,
  error_message = NULL,
  last_error_code = NULL,
  next_attempt_at = NULL,
  locked_at = NULL
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
  -- Add more filters to be specific
  AND domain = 'baskets';

-- Trigger worker to process
-- POST to /functions/v1/notification-worker
```

### Bulk update quiet hours for all contacts

```sql
-- Set default quiet hours 22:00-07:00 for all contacts without preferences
INSERT INTO contact_preferences (wa_id, quiet_hours_start, quiet_hours_end)
SELECT DISTINCT to_wa_id, '22:00'::time, '07:00'::time
FROM notifications
WHERE to_wa_id NOT IN (SELECT wa_id FROM contact_preferences)
ON CONFLICT (wa_id) DO NOTHING;
```

### Export notification metrics for reporting

```sql
-- Daily summary by domain
SELECT 
  DATE(created_at AT TIME ZONE 'Africa/Kigali') as date,
  domain,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'queued') as queued,
  ROUND(AVG(retry_count), 2) as avg_retries
FROM notifications
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY date, domain
ORDER BY date DESC, domain;
```

## Monitoring & Alerts

### Key Metrics to Track

1. **Queue Depth**: `notification_queue_depth`
   - Alert if > 1000 for > 5 minutes

2. **Worker Health**: `NOTIFY_WORKER_START` events
   - Alert if no events for > 5 minutes

3. **Failure Rate**: `notification_failed / (notification_sent + notification_failed)`
   - Alert if > 20% over 1 hour

4. **Opt-out Rate**: `notification_filtered_optout`
   - Track trend, alert if sudden spike (> 50/hour)

5. **Quiet Hours Deferrals**: `notification_deferred_quiet_hours`
   - Track to ensure quiet hours working

6. **Rate Limit Hits**: `notification_deferred{error_code="131047"}`
   - Alert if > 10/minute (reduce send rate)

### Grafana Dashboard Queries

```promql
# Queue depth
notification_queue_depth{trigger="cron"}

# Success rate by domain
100 * (
  rate(notification_sent_total{domain="baskets"}[5m]) /
  (rate(notification_sent_total{domain="baskets"}[5m]) + 
   rate(notification_failed_total{domain="baskets"}[5m]))
)

# Worker latency P99
histogram_quantile(0.99, notification_worker_latency_ms_bucket)

# Failure rate by error code
rate(notification_failed_total[5m]) by (error_code)
```

## Maintenance Tasks

### Daily

- [ ] Check queue depth (should be < 100)
- [ ] Check failure rate (should be < 5%)
- [ ] Review any new error codes
- [ ] Check worker latency P99 (should be < 5s)

### Weekly

- [ ] Review opt-out rate trend
- [ ] Check template approval status in Meta
- [ ] Review and retry any stuck failed notifications
- [ ] Export and analyze notification metrics
- [ ] Clean up old audit logs (> 90 days)

### Monthly

- [ ] Update template catalog with any new templates
- [ ] Review and optimize retry policies per template
- [ ] Audit contact preferences for accuracy
- [ ] Review and update quiet hours policies if needed
- [ ] Check Meta API rate limits and adjust if needed

## Escalation

### L1 Support (First Response)

Can handle:
- Queue stuck issues (reset locks)
- Basic status checks
- Manual notification retry
- User opt-out management

Escalate to L2 if:
- High failure rate (> 20%)
- Meta account issues (bans, restrictions)
- Template approval problems
- Worker not starting

### L2 Support (Engineering)

Can handle:
- Worker debugging and fixes
- Template configuration issues
- Meta API integration problems
- Performance optimization
- Database query optimization

Escalate to L3 if:
- Core infrastructure issues
- Database corruption
- Supabase platform issues
- Need Meta support escalation

### L3 Support (Platform Team)

Can handle:
- Infrastructure changes
- Database migrations
- Platform-wide issues
- Meta partnership escalations

## Emergency Procedures

### Stop all notifications immediately

```sql
-- Disable cron in Supabase Dashboard
-- Set NOTIFICATION_WORKER_CRON_ENABLED=false

-- Mark all queued as failed
UPDATE notifications
SET status = 'failed',
    error_message = 'Emergency stop - manual intervention'
WHERE status = 'queued';
```

### Resume after emergency stop

```sql
-- Verify issue is resolved
-- Re-enable cron in Supabase Dashboard
-- Set NOTIFICATION_WORKER_CRON_ENABLED=true

-- Reset failed notifications from emergency stop
UPDATE notifications
SET status = 'queued',
    error_message = NULL,
    retry_count = 0
WHERE error_message = 'Emergency stop - manual intervention'
  AND created_at > NOW() - INTERVAL '1 hour';
```

## Useful Queries

### Top 10 recipients by notification count

```sql
SELECT 
  to_wa_id,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY to_wa_id
ORDER BY total DESC
LIMIT 10;
```

### Notifications by hour of day

```sql
SELECT 
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Africa/Kigali') as hour,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*), 2) as success_rate
FROM notifications
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```

### Most common error messages

```sql
SELECT 
  error_message,
  last_error_code,
  COUNT(*) as occurrences,
  MAX(created_at) as last_seen
FROM notifications
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_message, last_error_code
ORDER BY occurrences DESC
LIMIT 10;
```

### Audit trail for specific notification

```sql
SELECT 
  n.id,
  n.status,
  n.created_at,
  n.sent_at,
  n.retry_count,
  nal.event_type,
  nal.details,
  nal.created_at as event_at
FROM notifications n
LEFT JOIN notification_audit_log nal ON nal.notification_id = n.id
WHERE n.correlation_id = 'your_correlation_id'
ORDER BY nal.created_at;
```

## Contact

- **Slack Channel**: #notifications-alerts
- **On-call Engineer**: See PagerDuty schedule
- **Documentation**: [GitHub Wiki](https://github.com/ikanisa/easymo/wiki)
- **Meta Support**: [Facebook Business Help Center](https://www.facebook.com/business/help)

## References

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy)
- [Meta Error Codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
