# Observability Audit

## Structured events

- `WEBHOOK_REQUEST_RECEIVED`, `WEBHOOK_BODY_READ`, `SIG_VERIFY_OK/FAIL`,
  `WEBHOOK_NO_MESSAGE`, `IDEMPOTENCY_HIT/MISS`, `WEBHOOK_RESPONSE`.
- `MATCHES_CALL`, `MATCHES_RESULT`, `MATCH_OPTIONS`, `MATCH_SELECTION` for
  mobility flows.
- `FLOW_EXCHANGE_REQUEST/RESPONSE` with masked WA IDs.
- Admin events: `ADMIN_FLOW_ROUTED`, `ADMIN_PIN_REQUIRED`, `ADMIN_ACTION`,
  `ADMIN_DENIED`, `ADMIN_TRIPS_*`, etc.
- QR: `QR_RESOLVE_OK/FAIL`.
- Notifications: `NOTIFY_WORKER_START/DONE`.

## Logging gaps / TODO

- Broadcast/templates placeholders currently log actions but skip message
  counts.
- Add metrics for notification retries (retry_count/next_attempt_at tracked in
  DB).
- Consider structured logging for OCR worker once implemented.
