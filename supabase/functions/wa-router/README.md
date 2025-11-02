# WhatsApp Router Edge Function

A lightweight edge function that serves as a single webhook endpoint for the WhatsApp Business API. It verifies webhook signatures,
normalizes incoming messages, and fans the payload out to downstream applications based on keyword rules stored in Supabase.

## Features

- **Webhook Verification**: Handles GET requests for Meta's webhook verification challenge
- **Signature Verification**: Validates `X-Hub-Signature-256` headers using HMAC SHA-256
- **Message Normalization**: Extracts and normalizes WhatsApp message envelopes into a consistent format
- **Keyword-Based Routing**: Routes messages using the `router_keyword_destinations` view backed by Supabase tables
- **Structured Logging**: Writes durable traces to `router_logs`, `router_telemetry`, and emits JSON console logs with correlation IDs
- **Error Resilience**: Always returns 200 to Meta to prevent retry storms while recording downstream failures
- **Idempotency & Rate Limiting**: Prevents signature replay via `router_idempotency` and throttles noisy senders using the
  `router_enforce_rate_limit` function

## Environment Variables

### Required

- `WA_VERIFY_TOKEN`: Token used for webhook verification (GET requests)
- `WA_APP_SECRET`: WhatsApp App Secret for signature verification
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: Required for database-backed routing, idempotency, rate limiting, and telemetry

### Routing & controls

- `ROUTER_ENABLED`: Optional feature flag (defaults to `true`). Set to `false` to gracefully disable routing.
- `ROUTER_DEST_ALLOWLIST`: Comma-separated list of destination slugs or hostnames permitted to receive fan-out requests (e.g.
  `insurance-primary,router.internal.local`).
- `ROUTER_RATE_LIMIT_MAX_MESSAGES`: Maximum messages per sender per window (defaults to `20`).
- `ROUTER_RATE_LIMIT_WINDOW_SECONDS`: Size of the rate-limit window in seconds (defaults to `60`).
- `ROUTER_DEST_TIMEOUT_MS`: Downstream fetch timeout in milliseconds (defaults to `7000`).
- `ROUTER_KEYWORD_CACHE_TTL_MS`: Keyword + destination cache TTL in milliseconds (defaults to `30000`).

## Keyword management

Keywords live in `public.router_keyword_map`. Each keyword resolves to a route key which maps to one or more active destinations in
`public.router_destinations`. The read-optimized view `public.router_keyword_destinations` powers the edge function. Example query:

```sql
SELECT * FROM public.router_keyword_destinations ORDER BY keyword;
```

## Payload Format

The router forwards a normalized payload to destination URLs:

```json
{
  "normalized": {
    "from": "250788000001",
    "messageId": "wamid.HBgM...",
    "type": "text",
    "text": "I want insurance",
    "keyword": "insurance",
    "metadata": {
      "phoneNumberId": "123456789",
      "displayPhoneNumber": "250788000000"
    }
  },
  "original": {
    // Original WhatsApp webhook payload
  }
}
```

## Deployment

This function is designed to be deployed as a Supabase Edge Function:

```bash
supabase functions deploy wa-router
```

### Set Environment Variables

```bash
supabase secrets set WA_VERIFY_TOKEN=your_verify_token
supabase secrets set WA_APP_SECRET=your_app_secret
supabase secrets set SUPABASE_URL=$SUPABASE_URL
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
supabase secrets set ROUTER_DEST_ALLOWLIST=insurance-primary,basket-primary,qr-primary,dine-primary,easymo-primary
supabase secrets set ROUTER_RATE_LIMIT_MAX_MESSAGES=20
supabase secrets set ROUTER_RATE_LIMIT_WINDOW_SECONDS=60
```

## Testing

Run the test suite (new implementation lives in `apps/router-fn` but the Supabase wrapper re-exports the handler):

```bash
deno test -A apps/router-fn/src
```

## Webhook Configuration

Configure your WhatsApp Business API webhook:

1. **Webhook URL**: `https://your-project.supabase.co/functions/v1/wa-router`
2. **Verify Token**: Set to the value of `WA_VERIFY_TOKEN`
3. **Webhook Fields**: Subscribe to `messages`

## Logs

All events are logged in structured JSON format with correlation IDs:

```json
{
  "event": "ROUTE_COMPLETED",
  "timestamp": "2025-10-27T15:55:53.300Z",
  "correlationId": "uuid-here",
  "messageId": "wamid.HBgM...",
  "keyword": "insurance",
  "destinationUrl": "https://your-app.com/insurance",
  "status": 200,
  "responseTime": 150
}
```

### Event Types

- `WEBHOOK_VERIFICATION_REQUEST`: GET request received
- `WEBHOOK_VERIFICATION_SUCCESS`: Verification succeeded
- `WEBHOOK_VERIFICATION_FAILED`: Verification failed
- `REQUEST_RECEIVED`: POST request received
- `SIGNATURE_VERIFIED`: Signature validation passed
- `SIGNATURE_VERIFICATION_FAILED`: Signature validation failed
- `PAYLOAD_NORMALIZED`: Messages extracted and normalized
- `NO_ROUTE_FOUND` / `keyword_unmatched`: No matching keyword or allowlist failure
- `MESSAGE_ALREADY_PROCESSED`: Message dropped due to idempotency replay
- `ROUTE_COMPLETED` & `downstream_error`: Downstream success/failure with response metadata
- `REQUEST_COMPLETED`: Full request processing completed
- `UNHANDLED_ERROR`: Unexpected error occurred

## Code Size

The core implementation lives in `apps/router-fn/src`. The Supabase edge function simply re-exports the shared handler via
`import { handleRequest } from "../../../apps/router-fn/src/router.ts";`.
