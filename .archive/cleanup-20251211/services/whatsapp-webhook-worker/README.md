# WhatsApp Webhook Worker

Durable, queue-based worker for processing WhatsApp webhooks asynchronously.

## Features

- **Kafka-based queue**: Decouples webhook ingestion from processing
- **Idempotency**: Prevents duplicate message processing using Redis
- **Retry logic**: Automatic retries with exponential backoff
- **Dead letter queue**: Failed messages are sent to DLQ for manual review
- **Metrics**: Built-in success/failure counters and latency tracking
- **Graceful shutdown**: Properly drains messages before shutdown

## Architecture

```
WhatsApp → wa-webhook (Edge Function) → Kafka Topic → Worker → Processing
                                                          ↓
                                                    Processed Topic
                                                          ↓
                                                        DLQ (failures)
```

## Configuration

See `.env.example` for all configuration options.

Key settings:
- `KAFKA_BROKERS`: Kafka broker addresses
- `REDIS_URL`: Redis for idempotency
- `MAX_RETRIES`: Number of retries before DLQ (default: 3)
- `RETRY_DELAY_MS`: Base delay for exponential backoff (default: 1000ms)

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm start:dev

# Build
pnpm build

# Run in production
pnpm start
```

## Monitoring

Health check endpoint:
```bash
curl http://localhost:4900/health
```

The `/health` endpoint now performs live dependency probes and returns detailed
JSON including latency and failure reasons:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "checks": {
    "openai": { "status": "ok", "latencyMs": 152 },
    "redis": { "status": "ok", "latencyMs": 8 },
    "supabase": { "status": "ok", "latencyMs": 32 }
  },
  "worker": {
    "running": true,
    "metrics": { "processed": 42, "failed": 0, "retried": 0, "deadLettered": 0 }
  }
}
```

If any probe fails, the endpoint responds with HTTP `503` and includes the
captured error message and upstream status code (if available) so monitors can
pinpoint the root cause quickly.

Metrics endpoint:
```bash
curl http://localhost:4900/metrics
```

## Integration

To integrate with existing wa-webhook Edge Function, publish webhook payloads to the `whatsapp.webhook.inbound` Kafka topic:

```typescript
await producer.send({
  topic: "whatsapp.webhook.inbound",
  messages: [{
    key: webhookId,
    value: JSON.stringify({
      id: webhookId,
      headers: req.headers,
      body: webhookPayload,
      timestamp: new Date().toISOString(),
    }),
  }],
});
```
