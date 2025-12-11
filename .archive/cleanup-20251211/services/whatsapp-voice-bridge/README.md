# WhatsApp Voice Bridge Service

WebRTC media server that bridges WhatsApp voice calls to OpenAI Realtime API.

## Architecture

```
WhatsApp (WebRTC) ↔ Voice Bridge ↔ OpenAI Realtime API
```

## Features

- WebRTC peer connection with WhatsApp
- RTP audio packet handling
- Audio format conversion (G.711/Opus ↔ PCM)
- Bidirectional audio streaming
- OpenAI Realtime API integration

## Development Status

**Phase 1:** ✅ COMPLETE
- Project structure
- Main server
- Session management
- WebRTC skeleton
- OpenAI connection skeleton

**Phase 2:** ⏳ IN PROGRESS
- Full WebRTC implementation
- Audio codec handling
- RTP packet processing  
- Complete audio bridging

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials

# Development
pnpm dev

# Build
pnpm build

# Production
pnpm start
```

## API Endpoints

### POST /sessions/start
Start a new voice call session

**Request:**
```json
{
  "callId": "wacid.xxx",
  "sdpOffer": "v=0\r\no=...",
  "fromNumber": "+1234567890",
  "toNumber": "+0987654321"
}
```

**Response:**
```json
{
  "success": true,
  "callId": "wacid.xxx",
  "sdpAnswer": "v=0\r\no=...",
  "sessionId": "session_xxx"
}
```

### POST /sessions/:callId/stop
Stop an active session

### GET /sessions/:callId
Get session status

### GET /sessions
List all active sessions

### GET /health
Health check

## Deployment

```bash
# Docker
docker build -t whatsapp-voice-bridge .
docker run -p 3100:3100 --env-file .env whatsapp-voice-bridge

# Cloud Run
gcloud run deploy whatsapp-voice-bridge \
  --source . \
  --platform managed \
  --region us-central1
```

## Timeline

- **Day 1:** Setup + WebRTC implementation
- **Day 2:** Audio processing + OpenAI integration
- **Day 3:** Bidirectional bridge + testing
- **Day 4:** Optimization + deployment

**Estimated completion:** December 10, 2025
