# Alert Webhook Integration

Set `ALERT_WEBHOOK_URL` (function-level secret) to receive JSON payloads
whenever critical flows fail:

- `INS_OCR_FAIL` – insurance OCR call failed or timed out.
- `INS_ADMIN_NOTIFY_FAIL` – admin notifications could not be sent.
- `MATCHES_ERROR` – mobility matching issues (nearby, schedule
  origin/dropoff/refresh).
- `NOTIFY_SEND_FAIL` – notification queue exhausted retries.
- `NOTIFY_CRON_*` – cron disabled, unsupported, or failed.
- `ORDER_PENDING_REMINDER_*` – vendor pending reminder worker partial/total
  failures.
- `CART_REMINDER_*` – customer cart reminder worker errors or quiet-hours
  violations.

Payload example:

```json
{
  "event": "INS_OCR_FAIL",
  "payload": {
    "leadId": "...",
    "error": "OpenAI request failed: ..."
  },
  "timestamp": "2025-09-25T20:42:00.123Z"
}
```

Use this hook to integrate with Slack, PagerDuty, or any monitoring system. If
the webhook is omitted, alerts degrade gracefully to console + structured logs.
