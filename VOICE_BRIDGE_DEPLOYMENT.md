# Voice Bridge Deployment Guide

## Option 1: Local Development

```bash
cd services/whatsapp-voice-bridge

# Install dependencies
pnpm install

# Create .env file
cp .env.example .env

# Edit .env with your actual values
nano .env

# Run in development mode
pnpm dev
```

The bridge will run on `http://localhost:3100`

Set in Supabase:
```bash
supabase secrets set VOICE_BRIDGE_URL="http://localhost:3100"
```

## Option 2: Docker Deployment

```bash
cd services/whatsapp-voice-bridge

# Build image
docker build -t whatsapp-voice-bridge .

# Run container
docker run -d \
  --name whatsapp-voice-bridge \
  -p 3100:3100 \
  -e SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="your-key" \
  -e OPENAI_API_KEY="your-key" \
  -e OPENAI_ORG_ID="org-4Kr7lOqpDhJErYgyGzwgSduN" \
  -e OPENAI_PROJECT_ID="proj_BL7HHgepm76lhElLqmfOckIU" \
  -e OPENAI_REALTIME_MODEL="gpt-5-realtime" \
  whatsapp-voice-bridge
```

## Option 3: Cloud Run Deployment

```bash
# Deploy to Google Cloud Run
cd services/whatsapp-voice-bridge

gcloud run deploy whatsapp-voice-bridge \
  --source . \
  --platform managed \
  --region us-east-1 \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co" \
  --set-env-vars OPENAI_ORG_ID="org-4Kr7lOqpDhJErYgyGzwgSduN" \
  --set-env-vars OPENAI_PROJECT_ID="proj_BL7HHgepm76lhElLqmfOckIU" \
  --set-env-vars OPENAI_REALTIME_MODEL="gpt-5-realtime" \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest
```

This will give you a URL like: `https://whatsapp-voice-bridge-xxxxx-uc.a.run.app`

Then set in Supabase:
```bash
supabase secrets set VOICE_BRIDGE_URL="https://whatsapp-voice-bridge-xxxxx-uc.a.run.app"
```

## Testing the Bridge

```bash
# Health check
curl http://localhost:3100/health

# Test session start (with mock SDP)
curl -X POST http://localhost:3100/sessions/start \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test123",
    "sdpOffer": "v=0...",
    "fromNumber": "+1234567890",
    "toNumber": "+0987654321",
    "userName": "Test User",
    "language": "en"
  }'
```

## Required Environment Variables

```env
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN
OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU
OPENAI_REALTIME_MODEL=gpt-5-realtime
PORT=3100
NODE_ENV=production
LOG_LEVEL=info
```

## Deploy Edge Function

After deploying the voice bridge:

```bash
# Deploy updated edge function
supabase functions deploy wa-webhook-voice-calls

# Verify
supabase functions list
```

## Monitor Logs

```bash
# Voice bridge logs (if using Docker)
docker logs -f whatsapp-voice-bridge

# Edge function logs
supabase functions logs wa-webhook-voice-calls --tail
```

