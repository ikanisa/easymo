# Voice Bridge Service

Phase 4 bridge that connects Twilio Media Streams with OpenAI Realtime responses and forwards operational signals into Kafka.

## Features

- Authenticated WebSocket endpoint for Twilio Media Streams (`/twilio-media`).
- Streaming audio relayed to OpenAI Realtime API with compliance prompt injection.
- Opt-out detection (STOP/END/CANCEL) with Kafka notifications and idempotent guarding via Redis.
- Media and contact events published to Kafka topics for downstream orchestration.

## Quick Start

```bash
cp .env.example .env
pnpm install
pnpm --filter @easymo/messaging build
pnpm --filter @easymo/voice-bridge build
pnpm --filter @easymo/voice-bridge start:dev
```

Expose the service via a secure tunnel when configuring Twilio Media Streams.

## Environment

See `.env.example` for the required variables. Kafka and Redis must be reachable before accepting live traffic.

## Testing

```bash
pnpm --filter @easymo/voice-bridge test
```
