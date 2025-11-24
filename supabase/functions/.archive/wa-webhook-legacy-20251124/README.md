# wa-webhook (Shared Library – Not Deployed)

This folder is a shared code library used by the deployed WhatsApp microservices.
It is no longer a deployed Edge Function by itself.

Deployed functions that import code from this folder:

- `wa-webhook-core` (ingress/router/health)
- `wa-webhook-ai-agents`
- `wa-webhook-mobility`
- `wa-webhook-wallet`
- `wa-webhook-jobs`
- `wa-webhook-property`
- `wa-webhook-marketplace`

Implications:

- Editing files here DOES NOT deploy anything by itself.
- You must redeploy the microservices above for changes to take effect.

Deploy all WhatsApp microservices:

```
pnpm run functions:deploy:wa
```

or directly with Supabase CLI:

```
supabase functions deploy \
  wa-webhook-core \
  wa-webhook-ai-agents \
  wa-webhook-mobility \
  wa-webhook-wallet \
  wa-webhook-jobs \
  wa-webhook-property \
  wa-webhook-marketplace
```

Typical modules in this library:

- `config.ts`: runtime configuration & Supabase client helpers
- `types.ts`: shared type definitions
- `router/`: message-type routers (media, interactive, location, text)
- `wa/`: WhatsApp client helpers and signature verification
- `state/`: chat state & idempotency utilities
- `flows/`: message-driven UX blocks
- `domains/`: business domain handlers (insurance, wallet, mobility, etc.)

Operational note: to verify live deployments, use `wa-webhook-core` health:

```
curl -s https://<project>.supabase.co/functions/v1/wa-webhook-core/health
```

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
