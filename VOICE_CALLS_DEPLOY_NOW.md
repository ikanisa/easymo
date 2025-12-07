# WhatsApp Voice Calls - Quick Deployment Guide

## 🚀 Deploy Voice Media Bridge to Cloud Run

### 1. Prerequisites

```bash
# Ensure you're in the right directory
cd services/voice-media-bridge

# Verify build works
npm install
npm run build
```

### 2. Deploy to Google Cloud Run

```bash
# Deploy
gcloud run deploy voice-media-bridge \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --set-env-vars \
OPENAI_API_KEY=<YOUR_KEY>,\
OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN,\
OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU,\
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80

# Get the service URL
gcloud run services describe voice-media-bridge --region us-east1 --format='value(status.url)'
```

### 3. Update Supabase Edge Function

```bash
# Set the voice media bridge URL
supabase secrets set VOICE_MEDIA_BRIDGE_URL="<CLOUD_RUN_URL>"

# Example:
# supabase secrets set VOICE_MEDIA_BRIDGE_URL="https://voice-media-bridge-xxx.run.app"
```

### 4. Test

```bash
# Health check
curl https://voice-media-bridge-xxx.run.app/health

# Should return:
# {"status":"healthy","service":"voice-media-bridge"}
```

### 5. Monitor

```bash
# View logs
gcloud run services logs read voice-media-bridge --region us-east1 --limit 50

# Watch in real-time
gcloud run services logs tail voice-media-bridge --region us-east1
```

## 🐳 Alternative: Docker Compose (Local)

```bash
# Add to docker-compose.yml or create new file
version: '3.8'

services:
  voice-media-bridge:
    build: ./services/voice-media-bridge
    ports:
      - "8080:8080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN
      - OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU
      - OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
    restart: unless-stopped

# Run
docker-compose up voice-media-bridge
```

## 📊 Next Steps

After deployment:

1. **Update wa-webhook-voice-calls** to call the media bridge
2. **Test WhatsApp voice call** end-to-end  
3. **Fix SDP validation** based on WhatsApp's response
4. **Implement audio pipeline** for full functionality

## 🔍 Troubleshooting

### SDP Validation Errors

If you see error 138008 "SDP Validation error":

1. Check logs for exact SDP format
2. Compare with WhatsApp's expected format
3. Adjust SDP generation in `src/index.ts` → `generateSDPAnswer()`

### OpenAI Connection Fails

```bash
# Verify API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Should list available models
```

### Service Won't Start

```bash
# Check build
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

---

**Documentation**: See `WHATSAPP_VOICE_IMPLEMENTATION_STATUS.md` for full status
