# Broker Orchestrator Service

Consumes multi-channel events (WhatsApp, voice, SIP) and coordinates downstream vendor sourcing plus wallet actions for Phase 4.

## Responsibilities

- Consolidates intents from `whatsapp.inbound`, voice contact events, and SIP signalling.
- Fetches enriched lead data from agent-core and emits orchestration commands on `broker.outbound`.
- Deduplicates processing with Redis idempotency and retries transient HTTP calls with exponential backoff.
- Stubs wallet integration when the external service is not configured.

## Local Execution

```bash
cp .env.example .env
pnpm install
pnpm --filter @easymo/messaging build
pnpm --filter @easymo/broker-orchestrator start:dev
```

Ensure Kafka and Redis are running (see `docker-compose.agent-core.yml` or local stack).

## Tests

```bash
pnpm --filter @easymo/broker-orchestrator test
```
