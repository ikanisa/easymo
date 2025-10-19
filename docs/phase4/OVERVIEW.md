# Phase 4 – Voice & Messaging Bridges

This phase introduces dedicated services for voice and messaging channels and establishes orchestration primitives for autonomous agents.

## Services

| Service | Description |
|---------|-------------|
| `@easymo/voice-bridge` | Twilio Media Streams → OpenAI Realtime bridge with Kafka fan-out. |
| `@easymo/sip-ingress` | HTTP gateway producing SIP signalling events and enforcing idempotency. |
| `@easymo/whatsapp-bot` | Meta webhook handler for WhatsApp intents and opt-outs. |
| `@easymo/broker-orchestrator` | Kafka consumer/producer that stitches WhatsApp, SIP, and voice feeds with agent-core tooling. |

## Infrastructure

- Kafka topics defined in `infrastructure/kafka/topics.yaml` (create via `kafka-topics.sh` helper).
- Redis required for idempotency across ingest surfaces.
- Monitoring dashboards under `dashboards/phase4/*.json` target Prometheus/Grafana.

## Quick Start

```bash
pnpm install
pnpm --filter @easymo/messaging build
pnpm --filter @easymo/voice-bridge build
pnpm --filter @easymo/sip-ingress build
pnpm --filter @easymo/whatsapp-bot build
pnpm --filter @easymo/broker-orchestrator build
```

Bring up dependencies via `docker compose -f docker-compose.agent-core.yml up kafka redis` (or equivalent) before running services locally.

## Testing

- `pnpm --filter @easymo/voice-bridge test` validates Twilio → Kafka hand-offs, MoMo voice prompts, and opt-out propagation into Agent-Core.
- `pnpm --filter @easymo/sip-ingress test` covers idempotent SIP ingest and retries.
- `pnpm --filter @easymo/whatsapp-bot test` confirms WhatsApp opt-outs and lead enrichment flow into the shared `OptOut` registry.
- `pnpm --filter @easymo/broker-orchestrator test` exercises routing logic across Kafka topics and verifies ranking payloads forwarded to wallet/buyer services.

## Observability

- Import `dashboards/phase4/voice_bridge.json` and `dashboards/phase4/messaging_overview.json` into Grafana; both reference Prometheus metrics exposed by the services above.
- Provision the Kafka topics in `infrastructure/kafka/topics.yaml` prior to running the suites so consumer lag panels render correctly.
- Each service emits structured logs (pino) keyed by `requestId` and `tenantId`; forward them to your log drain for cross-channel correlation.
