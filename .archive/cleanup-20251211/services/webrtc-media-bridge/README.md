# WebRTC Media Bridge

Custom WebRTC server bridging WhatsApp voice calls to OpenAI Realtime API (NO TWILIO).

## Quick Start

```bash
cd services/webrtc-media-bridge
pnpm install
pnpm dev
```

## Docker Deployment

```bash
docker-compose -f docker-compose.voice-media.yml up -d
```

## Endpoints

- `POST /bridge/start` - Start media bridge
- `POST /bridge/stop` - Stop media bridge
- `GET /health` - Health check

## See full documentation in code comments
