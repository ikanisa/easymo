# Voice Media Server

Custom WebRTC media server that bridges WhatsApp voice calls with OpenAI Realtime API.

## Architecture

```
WhatsApp User → WhatsApp Business API → wa-webhook-voice-calls (Edge Function)
                                              ↓
                                   Voice Media Server (WebRTC)
                                              ↓
                                   OpenAI Realtime API (WebSocket)
```

## Features

- ✅ WebRTC peer connection handling
- ✅ SDP offer/answer negotiation
- ✅ Audio streaming from WhatsApp to OpenAI
- ✅ Audio streaming from OpenAI back to WhatsApp
- ✅ Automatic session cleanup
- ✅ Health monitoring

## Deployment

### Local Development

```bash
cd services/voice-media-server
npm install
npm run dev
```

### Docker Deployment

```bash
docker build -t voice-media-server .
docker run -p 8080:8080 \
  -e SUPABASE_URL=https://xxx.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  -e OPENAI_API_KEY=sk-proj-... \
  -e OPENAI_REALTIME_MODEL=gpt-5-realtime \
  voice-media-server
```

### Google Cloud Run Deployment

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/voice-media-server

# Deploy to Cloud Run
gcloud run deploy voice-media-server \
  --image gcr.io/PROJECT_ID/voice-media-server \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --set-env-vars="SUPABASE_URL=https://xxx.supabase.co" \
  --set-env-vars="SUPABASE_SERVICE_ROLE_KEY=eyJ..." \
  --set-env-vars="OPENAI_API_KEY=sk-proj-..." \
  --set-env-vars="OPENAI_REALTIME_MODEL=gpt-5-realtime"
```

### Environment Variables

```bash
# Required
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-proj-...

# Optional
OPENAI_REALTIME_MODEL=gpt-5-realtime  # Default: gpt-5-realtime
PORT=8080                              # Default: 8080
```

### Update Supabase Edge Function

After deploying the media server, update the Edge Function environment variable:

```bash
supabase secrets set VOICE_MEDIA_SERVER_URL="https://voice-media-server-xxxxx-uc.a.run.app"
```

## API Endpoints

### POST /sessions/:callId/webrtc

Create a new WebRTC session for a WhatsApp call.

**Request:**
```json
{
  "sdpOffer": "v=0\r\no=- ...",
  "openaiModel": "gpt-5-realtime",
  "systemInstructions": "You are EasyMO AI...",
  "voice": "alloy"
}
```

**Response:**
```json
{
  "success": true,
  "sdpAnswer": "v=0\r\no=- ...",
  "sessionId": "call_abc123"
}
```

### DELETE /sessions/:callId

Terminate a WebRTC session.

**Response:**
```json
{
  "success": true
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "activeSessions": 3,
  "uptime": 12345
}
```

## Technical Details

### WebRTC Configuration

- **STUN Server**: `stun:stun.l.google.com:19302`
- **Audio Format**: PCM16 (16-bit, 16kHz)
- **Codecs**: Opus, PCMU (G.711)

### OpenAI Realtime API

- **Protocol**: WebSocket (`wss://api.openai.com/v1/realtime`)
- **Model**: GPT-5 Realtime
- **Modalities**: Text + Audio
- **Voice Detection**: Server-side VAD (Voice Activity Detection)

### Session Management

- **Auto-cleanup**: Sessions older than 30 minutes are automatically terminated
- **Cleanup interval**: Every 5 minutes

## Monitoring

Check active sessions:
```bash
curl https://voice-media-server-xxxxx.run.app/health
```

View logs:
```bash
# Docker
docker logs -f <container_id>

# Cloud Run
gcloud run logs read voice-media-server --region us-east1 --follow
```

## Troubleshooting

### No audio from WhatsApp

- Check SDP answer is valid
- Verify WebRTC connection is established
- Check firewall/NAT configuration

### No audio from OpenAI

- Verify OPENAI_API_KEY is correct
- Check OpenAI Realtime API quota
- Review WebSocket connection logs

### High latency

- Deploy media server in same region as Supabase
- Use Cloud Run with min instances > 0
- Check network connectivity

## Cost Estimates

- **Cloud Run**: ~$10-20/month (with cold starts)
- **OpenAI Realtime**: ~$0.06/min input + $0.24/min output
- **WhatsApp**: Per WhatsApp pricing

## Status

✅ **Phase 1**: Basic WebRTC setup - COMPLETE
✅ **Phase 2**: OpenAI integration - COMPLETE  
🔄 **Phase 3**: Audio streaming - IN PROGRESS
⏳ **Phase 4**: Production testing - PENDING

## Next Steps

1. Deploy to Cloud Run
2. Update Edge Function with media server URL
3. Test with real WhatsApp call
4. Monitor and optimize
