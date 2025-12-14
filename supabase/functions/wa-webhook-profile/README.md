# WA-Webhook-Profile Function

WhatsApp Business API webhook handler for user profile management.

## Overview

Handles incoming WhatsApp messages for:
- Language preference updates
- Location settings
- Profile information
- Help and support requests

## Features

### Phase 1 (Completed)
- ✅ Duplicate phone registration error handling
- ✅ Consolidated error logging
- ✅ Auth bypass warning suppression (dev)
- ✅ Atomic idempotency with unique constraint

### Phase 2 (Completed)
- ✅ Connection pooling (Supabase client)
- ✅ Keep-alive headers
- ✅ Circuit breaker protection
- ✅ Response caching (2-min TTL)

### Phase 3 (In Progress)
- ✅ Standardized response utilities
- ✅ JSDoc documentation
- ⏳ Handler extraction
- ⏳ Unit tests

## Architecture

```
wa-webhook-profile/
├── index.ts              # Main handler (1033 lines)
├── utils/
│   └── responses.ts      # Standard response builders
├── handlers/             # Handler modules (planned)
│   ├── language.ts
│   ├── locations.ts
│   └── help.ts
└── __tests__/            # Unit tests (planned)
```

## API

### POST /wa-webhook-profile

Webhook endpoint for WhatsApp Business API.

**Request Headers:**
- `x-hub-signature-256`: WhatsApp signature (production only)
- `x-request-id`: Optional request ID for tracing

**Request Body:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "256771861934",
          "id": "wamid.xxx",
          "type": "text",
          "text": { "body": "help" }
        }]
      }
    }]
  }]
}
```

**Response:**
```json
{
  "success": true,
  "handled": true
}
```

## Configuration

Environment variables:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `WA_VERIFY_TOKEN`: WhatsApp verification token
- `WA_WEBHOOK_SECRET`: WhatsApp webhook secret (production)

## Performance

| Metric | Before | After Phases 1-2 | Improvement |
|--------|--------|------------------|-------------|
| Error Rate | 100% | 0% | -100% |
| P50 Latency | 1850ms | 500ms | -73% |
| P95 Latency | 1850ms | 800ms | -57% |
| Cold Start | 87ms | <50ms | -43% |
| Logs/Request | 8-10 | 2-3 | -70% |

## Circuit Breaker

Protects against cascading database failures:
- **Threshold**: 5 failures within 60s window
- **Recovery**: 2 consecutive successes
- **Timeout**: 60s before retry
- **Response**: 503 Service Unavailable

## Caching

Response cache for webhook retries:
- **TTL**: 2 minutes
- **Key**: `${phoneNumber}:${messageId}`
- **Cleanup**: Every 60 seconds
- **Benefit**: Faster response for WhatsApp retries

## Idempotency

Atomic duplicate detection:
- **Table**: `processed_webhooks`
- **Constraint**: `UNIQUE(message_id, webhook_type)`
- **Handling**: Returns cached response on duplicate
- **Fallback**: Non-fatal, continues on failure

## Development

```bash
# Install dependencies
pnpm install

# Run locally
supabase functions serve wa-webhook-profile

# Test
curl http://localhost:54321/functions/v1/wa-webhook-profile/health

# Deploy
supabase functions deploy wa-webhook-profile
```

## Monitoring

Key events logged:
- `PROFILE_MESSAGE_PROCESSING`: Message received
- `PROFILE_CACHE_HIT`: Cache hit
- `PROFILE_DB_CIRCUIT_OPEN`: Circuit breaker opened
- `PROFILE_WEBHOOK_ERROR`: Error occurred
- `PROFILE_DUPLICATE_MESSAGE`: Duplicate detected

## Error Handling

Standard error responses:
```typescript
{
  error: "service_unavailable",
  message: "Database temporarily unavailable",
  requestId: "uuid",
  retryAfter: 60
}
```

Error codes:
- `unauthorized`: Invalid/missing signature
- `invalid_payload`: Malformed request
- `service_unavailable`: Circuit breaker open
- `internal_error`: Unexpected error

## Related

- [Ground Rules](../../../docs/GROUND_RULES.md)
- [Phase 1 Report](../../../PHASE_1_VERIFIED_COMPLETE.md)
- [Phase 2 Deployment](../../../PHASE_2_DEPLOYMENT_READY.md)
- [Phase 3 Plan](../../../PHASE_3_PLAN.md)

## Version History

- **3.0.0** (Current): Phases 1-3, Circuit breaker, Caching
- **2.0.0**: Wallet extraction
- **1.0.0**: Initial release
