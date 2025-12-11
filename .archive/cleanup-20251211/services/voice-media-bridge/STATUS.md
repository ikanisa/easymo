# Voice Media Bridge - WhatsApp Voice Calls Implementation

**Custom WebRTC media server bridging WhatsApp and OpenAI Realtime API**

## Quick Start

```bash
cd services/voice-media-bridge
npm install
npm run dev
```

## Docker Deployment

```bash
docker-compose up voice-media-bridge
```

## Status

✅ **PHASE 1 COMPLETE**: Basic infrastructure
🔄 **PHASE 2 IN PROGRESS**: Audio processing pipeline  
⏳ **PHASE 3 PENDING**: Production deployment

## Architecture

```
┌──────────────┐    WebRTC     ┌──────────────────┐    WebSocket    ┌──────────────┐
│   WhatsApp   │◄─────────────►│ Voice Media      │◄───────────────►│   OpenAI     │
│     User     │   (SDP/ICE)   │     Bridge       │  (Realtime API) │   GPT-5      │
└──────────────┘               └──────────────────┘                 └──────────────┘
```

## Next Steps

1. **Implement audio processing** (see README.md)
2. **Deploy to Cloud Run**
3. **Update wa-webhook-voice-calls** to use this service
4. **Test end-to-end**

See `README.md` for full documentation.
