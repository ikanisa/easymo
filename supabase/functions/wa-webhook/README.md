# wa-webhook

Additive edge function that modularises the WhatsApp webhook and new dine-in
flows. Modules:

- `index.ts`: entrypoint (GET verify, POST dispatch)
- `config.ts`: runtime configuration & Supabase client
- `deps.ts`: centralised imports
- `types.ts`: shared type definitions
- `health.ts`: health probe handler
- `wa/`: WhatsApp client helpers and signature verification
- `state/`: chat state & idempotency utilities
- `router/`: message-type routers (media, interactive, location, text)
- `rpc/`: Supabase access helpers (mobility, dine-in, marketplace, etc.)
- `flows/`: message-driven UX blocks
- `exchange/`: Flow Data Channel handlers (Meta WhatsApp Flows)
- `observe/`: logging and diagnostics utilities

This directory now houses both the original vendor upload handler and the v2
conversational flows so nothing is lost while keeping a single deployment
target. All new dine-in capabilities and future WA features should live here to
honour the repository's additive-only guard.

## Runtime configuration

Key environment variables consumed by the webhook:

- `WA_SUPABASE_SERVICE_ROLE_KEY` (preferred) / `SUPABASE_SERVICE_ROLE_KEY` –
  scoped service role for WhatsApp data access. Provide a least-privilege key
  that only touches `profiles`, `chat_state`, `wa_events`, `webhook_logs`, and
  notification tables.
- `WA_WEBHOOK_MAX_BYTES` – maximum request payload size (bytes). Defaults to
  `262144`. Requests exceeding the limit return `413` without processing.
- `WA_HTTP_TIMEOUT_MS`, `WA_HTTP_MAX_RETRIES`, `WA_HTTP_RETRY_DELAY_MS` –
  network timeout and retry controls for outbound Graph API calls. Default to
  10s timeout, one retry with 200 ms backoff.
- `WA_HTTP_STATUS_RETRIES`, `WA_HTTP_STATUS_RETRY_DELAY_MS` – retry policy for
  HTTP 408/429/5xx responses. Defaults: 2 retries, 400 ms incremental backoff.
- `WA_INBOUND_LOG_SAMPLE_RATE`, `WA_INBOUND_DEBUG_SNAPSHOT` – optional sampled
  logging of full inbound payloads. Both default to off (`0`). Only enable
  temporarily when debugging.
- `WA_EVENTS_TTL_DAYS`, `WA_WEBHOOK_LOGS_TTL_DAYS`, `WA_RETENTION_INTERVAL_MS` –
  retention controls for idempotency rows and webhook diagnostics. Defaults:
  30 days for `wa_events`, 14 days for `webhook_logs`, retention sweep every
  6 hours.
- `WA_ALLOWED_MSISDN_PREFIXES` – comma-separated E.164 prefixes that are
  permitted to create/update profiles. When unset, all prefixes are accepted.
- `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_TIMEOUT_MS` – optional alert drain and
  timeout (default 5 s).

See `docs/runbooks/wa-webhook.md` for the operational runbook (queue drain,
retention verification, debugging guidelines, and least-privilege role setup).

Operational notes:

- Retention runs asynchronously after requests and is idempotent. Monitor
  `RETENTION_WA_EVENTS_PURGED` / `RETENTION_WEBHOOK_LOGS_PURGED` structured
  events for delete counts.
- Sanitised structured logging is the default; full payload snapshots should
  only be enabled while debugging and with strict TTLs.
- Invalid or out-of-scope WhatsApp numbers are logged (masked) and skipped to
  avoid polluting `profiles`.
