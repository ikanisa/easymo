# WhatsApp Voice Bridge - Cloud Run Deployment Ready ✅

## 🎉 Status: READY TO DEPLOY

**Date**: December 7, 2025 06:26 UTC  
**Build**: ✅ Successful  
**Database**: ✅ Migrations Applied  
**Code**: ✅ Merged to Main

---

## 🚀 DEPLOY NOW - Manual Steps

### Step 1: Authenticate gcloud (if needed)
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Step 2: Deploy to Cloud Run
```bash
cd services/whatsapp-voice-bridge

gcloud run deploy whatsapp-voice-bridge \
  --source . \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "LOG_LEVEL=info" \
  --set-env-vars "PORT=8080" \
  --set-env-vars "OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN" \
  --set-env-vars "OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU" \
  --set-env-vars "OPENAI_REALTIME_MODEL=gpt-5-realtime" \
  --set-env-vars "SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc" \
  --set-env-vars "OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE"
```

**Replace `YOUR_OPENAI_KEY_HERE`** with your actual OpenAI API key (starts with `sk-proj-`)

### Step 3: Get the Service URL
```bash
SERVICE_URL=$(gcloud run services describe whatsapp-voice-bridge \
  --platform managed \
  --region us-east1 \
  --format 'value(status.url)')

echo "Service URL: $SERVICE_URL"
```

### Step 4: Test Health Endpoint
```bash
curl $SERVICE_URL/health

# Expected response:
# {"status":"ok","service":"whatsapp-voice-bridge","timestamp":"..."}
```

### Step 5: Update Supabase Secret
```bash
cd ../..
supabase secrets set VOICE_BRIDGE_URL="$SERVICE_URL" \
  --project-ref lhbowpbcpwoiparwnwgt
```

### Step 6: Deploy Edge Function
```bash
supabase functions deploy wa-webhook-voice-calls \
  --project-ref lhbowpbcpwoiparwnwgt
```

### Step 7: Integration Test
1. Call your WhatsApp Business number
2. **Expected**:
   - ✅ Hear GPT-5: "Hi, I'm EasyMO AI. How can I help you?"
   - ✅ Speak a question
   - ✅ Hear GPT-5 respond
   - ✅ Clear audio quality
   - ✅ Low latency

---

## 📋 Pre-Deployment Checklist

- [x] Code merged to main
- [x] TypeScript build successful
- [x] Database migrations applied
- [x] Service configuration ready
- [ ] **gcloud authentication** (required)
- [ ] **OpenAI API key** ready
- [ ] Deploy command ready to execute

---

## 🔐 Environment Variables

### Already Configured ✅
```bash
NODE_ENV=production
LOG_LEVEL=info
PORT=8080
OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN
OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU
OPENAI_REALTIME_MODEL=gpt-5-realtime
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... (configured)
```

### Required from You ⚠️
```bash
OPENAI_API_KEY=sk-proj-...  # Get from https://platform.openai.com/api-keys
```

**To get OpenAI API Key**:
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Name it "EasyMO Voice Bridge"
4. Enable "Realtime API" access
5. Copy the key (starts with `sk-proj-`)

---

## 🏗️ What's Being Deployed

### Service Architecture
```
WhatsApp Cloud API
    ↓ (WebRTC)
wa-webhook-voice-calls (Edge Function)
    ↓ (HTTP)
whatsapp-voice-bridge (Cloud Run) ← YOU ARE HERE
    ↓ (WebSocket)
OpenAI Realtime API (GPT-5)
```

### Audio Pipeline
```
WhatsApp (G.711 @ 8kHz)
    ↓
RTCAudioSink → PCM 8kHz
    ↓
Resample → PCM 24kHz
    ↓
Base64 encode → OpenAI
    ↓
OpenAI response → Base64
    ↓
Decode → PCM 24kHz
    ↓
Resample → PCM 8kHz
    ↓
RTCAudioSource → WhatsApp
```

### Service Specs
- **Platform**: Google Cloud Run
- **Region**: us-east1
- **Memory**: 512 MB
- **CPU**: 1 vCPU
- **Timeout**: 300 seconds (5 minutes)
- **Concurrency**: 80 requests
- **Min Instances**: 0 (scale to zero)
- **Max Instances**: 10

---

## 🧪 Post-Deployment Verification

### 1. Health Check
```bash
curl https://whatsapp-voice-bridge-...-ue.a.run.app/health
```
**Expected**: `{"status":"ok"}`

### 2. Check Logs
```bash
gcloud run services logs read whatsapp-voice-bridge \
  --region us-east1 \
  --limit 20
```

**Expected logs**:
- Service starting
- WebRTC initialization
- OpenAI connection ready

### 3. Test Call
1. Call WhatsApp Business number
2. Listen for GPT-5 greeting
3. Speak a question
4. Verify you hear response

---

## 🐛 Troubleshooting

### Deployment fails: "authentication required"
**Solution**:
```bash
gcloud auth login
gcloud auth application-default login
```

### Service deployed but health check fails
**Check**:
1. Logs: `gcloud run services logs read whatsapp-voice-bridge --region us-east1`
2. Environment variables: Check Cloud Run console
3. Port: Must be 8080

### No audio during call
**Check**:
1. OPENAI_API_KEY is correct (not placeholder)
2. Service logs show "Connected to OpenAI"
3. WebRTC connection established
4. Edge function deployed

---

## 📚 Documentation

- **Technical Guide**: `services/whatsapp-voice-bridge/AUDIO_PIPELINE_IMPLEMENTATION.md`
- **Deployment Guide**: `DEPLOYMENT_COMPLETE_AUDIO_PIPELINE.md`
- **Summary**: `DEPLOYMENT_SUMMARY.md`

---

## ✅ Deployment Checklist

### Pre-Deploy
- [x] Build successful
- [x] Environment configured
- [x] Database ready
- [ ] gcloud authenticated
- [ ] OpenAI key ready

### Deploy
- [ ] Service deployed
- [ ] Health check passing
- [ ] Logs clean

### Post-Deploy
- [ ] Supabase secret updated
- [ ] Edge function deployed
- [ ] Test call successful

---

## 🔗 Quick Commands

```bash
# Authenticate
gcloud auth login

# Deploy
cd services/whatsapp-voice-bridge
bash simple-deploy.sh  # (edit OPENAI_API_KEY first)

# Get URL
gcloud run services describe whatsapp-voice-bridge --region us-east1 --format 'value(status.url)'

# Test
curl $(gcloud run services describe whatsapp-voice-bridge --region us-east1 --format 'value(status.url)')/health

# Update Supabase
supabase secrets set VOICE_BRIDGE_URL="..." --project-ref lhbowpbcpwoiparwnwgt

# Deploy edge function
supabase functions deploy wa-webhook-voice-calls --project-ref lhbowpbcpwoiparwnwgt
```

---

**Status**: ✅ **READY TO DEPLOY - EXECUTE STEP 1**

All code is ready. You just need to:
1. Run `gcloud auth login` (if needed)
2. Get your OpenAI API key
3. Run the deploy command above
4. Test the service

The complete bidirectional audio pipeline is built and ready! 🚀
