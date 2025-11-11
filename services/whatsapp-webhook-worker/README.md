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
