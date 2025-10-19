# SIP Ingress Service

Collects SIP/webhook events from the PSTN edge and pushes normalised events into Kafka for downstream orchestration.

## Capabilities

- Validates incoming event payloads with Zod and guards duplicate delivery with Redis-backed idempotency.
- Publishes signalling events to `voice.sip.events` and lifecycles (connect/stop) to `voice.contact.events`.
- Provides lightweight health endpoint for Kubernetes probes.

## Local Development

```bash
cp .env.example .env
pnpm install
pnpm --filter @easymo/messaging build
pnpm --filter @easymo/sip-ingress start:dev
```

Send sample traffic:

```bash
curl -X POST http://localhost:4200/sip/events \
  -H 'Content-Type: application/json' \
  -d '{"callId":"demo","event":"connected"}'
```

## Testing

```bash
pnpm --filter @easymo/sip-ingress test
```
