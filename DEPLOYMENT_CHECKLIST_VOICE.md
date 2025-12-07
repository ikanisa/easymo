# 🚀 WhatsApp Voice Calls - Final Deployment Checklist

**Date:** December 7, 2025  
**Status:** Ready to Deploy

---

## ✅ Pre-Deployment Verification

### Code Complete
- [x] Media server implemented (`services/voice-media-server/`)
- [x] Webhook handler updated (`wa-webhook-voice-calls`)
- [x] SIP webhook ready (`openai-sip-webhook`)
- [x] Docker configuration complete
- [x] Environment variables documented

### Configuration Complete
- [x] OpenAI Organization ID set
- [x] OpenAI Project ID set
- [x] OpenAI API Key configured
- [x] OpenAI Webhook created (for SIP)
- [x] Model set to `gpt-5-realtime`

### Testing Complete
- [x] Webhook receiving calls ✅
- [x] SDP negotiation working ✅
- [x] Pre-accept/accept working ✅
- [ ] Media bridge working (blocked on deployment)
- [ ] End-to-end call test (blocked on deployment)

---

## 🚀 Deployment Steps

### Step 1: Start Media Server
```bash
cd /Users/jeanbosco/workspace/easymo/services/voice-media-server
docker-compose up --build -d
```

**Expected output:**
```
Creating network "voice-media-server_default"
Creating voice-media-server_media-server_1 ... done
```

**Verify:**
```bash
docker-compose ps
# Should show: media-server   Up   0.0.0.0:8080->8080/tcp
```

**Test health:**
```bash
curl http://localhost:8080/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

### Step 2: Configure Webhook
```bash
cd /Users/jeanbosco/workspace/easymo

# Set media server URL
supabase secrets set MEDIA_SERVER_URL="http://media-server:8080"

# Deploy webhook
supabase functions deploy wa-webhook-voice-calls
```

**Expected output:**
```
Deploying wa-webhook-voice-calls (project ref: lhbowpbcpwoiparwnwgt)
✓ Successfully deployed wa-webhook-voice-calls
```

---

### Step 3: Test Call
1. Open WhatsApp on your phone
2. Go to EasyMO business chat (+22893002751)
3. Tap the phone icon 📞
4. Wait for connection (~2-3 seconds)
5. **Expected:** AI answers with greeting

**AI should say:**
```
"Hello! This is EasyMO AI assistant. How can I help you today?"
```

---

## 📊 Monitoring

### Check Logs
```bash
# Media server logs
cd services/voice-media-server
docker-compose logs -f

# Webhook logs
supabase functions logs wa-webhook-voice-calls --tail
```

### Expected Log Sequence
```
1. WA_VOICE_WEBHOOK_RECEIVED
2. WA_CALL_CONNECT (with SDP)
3. MEDIA_BRIDGE_CREATE_REQUEST
4. WEBRTC_CONNECTION_ESTABLISHED
5. OPENAI_WEBSOCKET_CONNECTED
6. AUDIO_BRIDGE_ACTIVE
7. WA_CALL_ACCEPTED
8. CONVERSATION_STARTED
```

---

## 🎯 Success Criteria

### Call is Successful When:
- [ ] Call connects within 3 seconds
- [ ] User hears AI greeting
- [ ] AI hears user voice
- [ ] Conversation flows naturally
- [ ] No audio quality issues
- [ ] Call terminates cleanly

---

## 🔍 Troubleshooting

### Issue: Media server won't start
**Cause:** Docker not running  
**Fix:** Start Docker Desktop

### Issue: Can't connect to media server
**Cause:** Port 8080 already in use  
**Fix:** Change `PORT` in `.env` file

### Issue: Call connects but no audio
**Cause:** WebRTC connection failed  
**Fix:** Check media server logs for errors

### Issue: AI doesn't respond
**Cause:** OpenAI API key invalid or quota exceeded  
**Fix:** Verify API key and check OpenAI dashboard

---

## 📞 Post-Deployment Tests

### Test 1: Basic Call
1. Call from WhatsApp
2. Verify AI answers
3. Say "Hello"
4. Verify AI responds
5. Hang up
6. **Expected:** Clean termination

### Test 2: Conversation
1. Call from WhatsApp
2. Say "I need a ride to the airport"
3. Verify AI asks for location
4. Provide pickup location
5. **Expected:** AI confirms details

### Test 3: Multiple Calls
1. Make 3 calls in quick succession
2. **Expected:** All calls connect successfully
3. **Expected:** No degradation in quality

---

## 📈 Performance Metrics

### Expected Metrics
- **Call Connection Time:** <3 seconds
- **Audio Latency:** <500ms
- **Call Success Rate:** >95%
- **Audio Quality:** Excellent (16kHz PCM)
- **Concurrent Calls:** 100+ per instance

### Monitor
- Call volume
- Success rate
- Average call duration
- Errors per hour
- Resource usage (CPU, memory)

---

## 🔐 Security Checklist

- [x] API keys not hardcoded
- [x] Webhook signature verification enabled
- [x] Media server in private network
- [x] No public exposure of sensitive endpoints
- [x] Environment variables properly set
- [x] Logs don't contain PII

---

## 💰 Cost Monitoring

### Per Call
- WhatsApp: $0.00
- OpenAI (gpt-5-realtime): ~$0.24/min
- Infrastructure: $0.00 (self-hosted)

### Monthly Estimate (1000 calls, 5 min avg)
- Total minutes: 5,000
- Cost: 5,000 × $0.24 = **$1,200/month**

### Cost Optimization
- Monitor call duration
- Implement timeout (max 15 minutes)
- Cache common responses
- Use cheaper model for simple queries

---

## 📝 Rollback Plan

If deployment fails:

### Step 1: Stop Media Server
```bash
cd services/voice-media-server
docker-compose down
```

### Step 2: Revert Webhook
```bash
supabase secrets unset MEDIA_SERVER_URL
# Redeploy old version if needed
```

### Step 3: Investigate
- Check logs
- Review errors
- Fix issues
- Retry deployment

---

## 🎉 Go-Live Checklist

- [ ] Media server started
- [ ] Webhook deployed
- [ ] Test call successful
- [ ] Logs clean
- [ ] Performance acceptable
- [ ] Team notified
- [ ] Documentation updated

---

## 📚 Support Resources

### Documentation
- `VOICE_IMPLEMENTATION_SUMMARY.md` - Overview
- `WHATSAPP_VOICE_CALLS_STATUS.md` - Status
- `WEBRTC_VOICE_IMPLEMENTATION.md` - Technical details
- `docs/VOICE_CALLS_CONFIGURATION.md` - Configuration

### Code
- `services/voice-media-server/` - Media server
- `supabase/functions/wa-webhook-voice-calls/` - Webhook

### Monitoring
- Media server logs: `docker-compose logs -f`
- Webhook logs: `supabase functions logs wa-webhook-voice-calls`
- OpenAI dashboard: `platform.openai.com`

---

## 🚨 Emergency Contacts

### If Issues Arise
1. Check logs first
2. Review documentation
3. Contact team lead
4. Escalate if critical

---

**Ready to deploy?** Execute Step 1 above! 🚀

---

**Deployment Time Estimate:** 5-10 minutes  
**Rollback Time:** <2 minutes  
**Risk Level:** Low (can rollback quickly)

**Go for launch!** ✅
