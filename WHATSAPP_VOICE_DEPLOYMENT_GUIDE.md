# WhatsApp Voice Calling - Complete Deployment Guide

## ✅ Current Status (December 6, 2025 - 11:54pm)

### What's Working
- ✅ Webhook routing (wa-webhook-core forwards calls to wa-webhook-voice-calls)
- ✅ SDP generation (basic answer generation)
- ✅ WhatsApp API integration (pre-accept/accept calls)
- ✅ Voice Bridge service structure
- ✅ Audio processing pipeline (G.711, RTP, resampling)

### Critical Issue
❌ **Media bridging not implemented**: The SDP answer is accepted but audio doesn't flow because we're not actually establishing the WebRTC peer connection with media exchange.

## 📋 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     WhatsApp Voice Call Flow                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User taps 📞 in WhatsApp                                            │
│     │                                                                    │
│     ▼                                                                    │
│  WhatsApp sends webhook:                                                │
│  POST /wa-webhook-core                                                  │
│    event: "connect"                                                     │
│    sdp_offer: "v=0\r\no=..."                                            │
│     │                                                                    │
│     ▼                                                                    │
│  wa-webhook-core routes to:                                             │
│  POST /wa-webhook-voice-calls                                           │
│     │                                                                    │
│     ▼                                                                    │
│  Edge Function calls:                                                   │
│  POST https://voice-bridge.run.app/sessions/start                       │
│    {                                                                     │
│      callId: "wacid.xxx",                                               │
│      sdpOffer: "...",                                                   │
│      fromNumber: "+1234567890"                                          │
│    }                                                                     │
│     │                                                                    │
│     ▼                                                                    │
│  Voice Bridge:                                                          │
│    1. Creates WebRTC peer connection                                    │
│    2. Generates SDP answer                                              │
│    3. Connects to OpenAI Realtime WebSocket                             │
│    4. Starts audio bridging loop                                        │
│     │                                                                    │
│     ▼                                                                    │
│  Edge Function:                                                         │
│  POST https://graph.facebook.com/.../calls                              │
│    action: "pre_accept"                                                 │
│    sdp_answer: "..."                                                    │
│     │                                                                    │
│     ▼                                                                    │
│  POST https://graph.facebook.com/.../calls                              │
│    action: "accept"                                                     │
│     │                                                                    │
│     ▼                                                                    │
│  ✅ WebRTC media flow established                                       │
│  ✅ Audio streaming WhatsApp ↔ OpenAI                                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Deployment Steps

### Phase 1: Deploy Voice Bridge Service (TODAY)

```bash
cd services/whatsapp-voice-bridge

# 1. Install dependencies
pnpm install

# 2. Build
pnpm build

# 3. Test locally
cp .env.example .env
# Edit .env with your credentials:
#   OPENAI_API_KEY=sk-proj-...
#   OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN
#   OPENAI_REALTIME_MODEL=gpt-5-realtime
#   SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=...

pnpm dev  # Should start on port 3100

# 4. Deploy to Cloud Run
gcloud run deploy whatsapp-voice-bridge \
  --source . \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --set-env-vars "OPENAI_API_KEY=${OPENAI_API_KEY}" \
  --set-env-vars "OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN" \
  --set-env-vars "OPENAI_REALTIME_MODEL=gpt-5-realtime" \
  --set-env-vars "SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co" \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest"

# Note the deployed URL: https://whatsapp-voice-bridge-xxx.run.app
```

### Phase 2: Update Edge Function

```bash
# Set Voice Bridge URL in Supabase secrets
supabase secrets set VOICE_BRIDGE_URL="https://whatsapp-voice-bridge-xxx.run.app"

# Deploy updated Edge Function
supabase functions deploy wa-webhook-voice-calls
```

### Phase 3: Test End-to-End

```bash
# 1. Make a WhatsApp voice call to your business number
# 2. Check logs:
supabase functions logs wa-webhook-voice-calls --tail
# 3. Check Voice Bridge logs:
gcloud run logs read whatsapp-voice-bridge --tail

# Expected flow:
# ✅ "WA_CALL_CONNECT" - Call received
# ✅ "VOICE_BRIDGE_SESSION_CREATED" - Bridge started
# ✅ "WA_CALL_PRE_ACCEPTED" - SDP pre-accepted
# ✅ "WA_CALL_ACCEPTED" - Call accepted
# ✅ "OPENAI_SESSION_CREATED" - AI connected
# ✅ "MEDIA_BRIDGE_ACTIVE" - Audio flowing
```

## 🔧 Current Limitations & Solutions

### Issue 1: WebRTC in Deno Edge Functions
**Problem**: Deno Edge Functions don't support WebRTC peer connections
**Solution**: Use separate Node.js service (whatsapp-voice-bridge) for WebRTC

### Issue 2: RTP Packet Access
**Problem**: `wrtc` library doesn't expose raw RTP packets easily
**Solution**: 
- Option A: Use `node-webrtc-media` for direct RTP access (complex)
- Option B: Use MediaStream API with audio worklets (simpler)
- **Chosen**: Option B with future upgrade to Option A

### Issue 3: Audio Format Conversion
**Problem**: WhatsApp uses G.711 @ 8kHz, OpenAI needs PCM @ 24kHz
**Solution**: Implemented in `audio-processor.ts`:
- G.711 decode → PCM 8kHz
- Resample 8kHz → 24kHz
- Base64 encode → OpenAI
- Reverse for playback

## 📊 Performance Requirements

### Latency Targets
- SDP Answer generation: < 500ms
- Pre-accept API call: < 1000ms
- Accept API call: < 1000ms
- Total time to media flow: < 2500ms

### Audio Quality
- Sample rate: 24kHz (OpenAI requirement)
- Bit depth: 16-bit PCM
- Codec: G.711 μ-law/A-law (WhatsApp)
- Latency: < 100ms audio delay

## 🔍 Debugging

### Check Voice Bridge Health
```bash
curl https://whatsapp-voice-bridge-xxx.run.app/health
# Expected: {"status":"healthy","activeCalls":0}
```

### Monitor Active Sessions
```bash
curl https://whatsapp-voice-bridge-xxx.run.app/sessions
# Shows all active call sessions
```

### View Session Details
```bash
curl https://whatsapp-voice-bridge-xxx.run.app/sessions/wacid.xxx
# Shows specific session status
```

### Common Errors

#### "SDP Validation error"
- **Cause**: Invalid SDP format
- **Fix**: Check `generateSDPAnswer` function, ensure proper codec list

#### "Media connection timeout"
- **Cause**: WebRTC peer connection failed
- **Fix**: Check ICE servers, firewall rules, STUN/TURN configuration

#### "OpenAI session creation failed"
- **Cause**: Invalid API key or model
- **Fix**: Verify `OPENAI_API_KEY` and `OPENAI_REALTIME_MODEL=gpt-5-realtime`

## 📝 Next Steps (Post-Deployment)

### Week 1: Stabilization
- [ ] Monitor call success rate (target: > 95%)
- [ ] Optimize latency (target: < 2s to media flow)
- [ ] Add error recovery (auto-retry on failures)

### Week 2: Enhancements
- [ ] Implement call recording
- [ ] Add real-time transcription
- [ ] Multi-language detection
- [ ] Call quality metrics

### Week 3: Scale
- [ ] Load testing (100 concurrent calls)
- [ ] Auto-scaling configuration
- [ ] Regional deployment (reduce latency)
- [ ] CDN for static assets

## 💰 Cost Estimates

### OpenAI Realtime API
- Input audio: ~$0.06/minute
- Output audio: ~$0.24/minute
- **Total per call**: ~$0.30/minute

### Cloud Run (Voice Bridge)
- CPU: ~$0.00002448/vCPU-second
- Memory: ~$0.00000271/GB-second  
- **Estimate**: ~$0.01/minute/instance

### WhatsApp Business API
- Voice calls: Varies by country
- **Rwanda**: ~$0.05/minute
- **Malta**: ~$0.10/minute

### Total Cost Per Minute
- **Rwanda**: ~$0.36/minute
- **Malta**: ~$0.41/minute

## 🎯 Success Criteria

✅ **Phase 1 Complete** (Current)
- [x] Webhook routing working
- [x] SDP generation working
- [x] WhatsApp API integration working
- [x] Voice Bridge service built

⏳ **Phase 2 In Progress** (Deploy Voice Bridge)
- [ ] Voice Bridge deployed to Cloud Run
- [ ] Edge Function updated to call Voice Bridge
- [ ] End-to-end test successful

⏳ **Phase 3 Pending** (Audio Bridge)
- [ ] WebRTC media connection established
- [ ] Audio flowing WhatsApp → OpenAI
- [ ] Audio flowing OpenAI → WhatsApp
- [ ] Call duration > 30 seconds

🎉 **PRODUCTION READY**
- [ ] 10 successful test calls
- [ ] Average latency < 2.5s
- [ ] Audio quality rated good
- [ ] Error rate < 5%

## 📞 Support Contacts

- **WhatsApp API**: Meta Business Support
- **OpenAI Realtime**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **Cloud Run**: GCP Support

---

**Last Updated**: December 6, 2025 23:54 UTC
**Next Review**: After Voice Bridge deployment
**Status**: 🟡 Phase 2 - Voice Bridge Deployment
