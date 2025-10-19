# WhatsApp Bot Service

Facebook/WhatsApp webhook handler that captures intents, detects opt-out keywords, and pushes normalised events into Kafka for orchestrators.

## Highlights

- Challenge/response verification for Meta webhook subscription.
- Idempotent ingestion keyed by WhatsApp message ID with Redis storage.
- Publishes inbound messages to `whatsapp.inbound`; opt-outs produce a control message on `whatsapp.outbound`.

## Running Locally

```bash
cp .env.example .env
pnpm install
pnpm --filter @easymo/messaging build
pnpm --filter @easymo/whatsapp-bot start:dev
```

Expose via ngrok and register the webhook URL in Meta Developer Console.

## Tests

```bash
pnpm --filter @easymo/whatsapp-bot test
```
