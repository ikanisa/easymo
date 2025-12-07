# WhatsApp Voice Call Debugging Guide

## 🔍 Current Status

**Call Flow**: ✅ Connecting → ❌ No Audio → ⚠️ Failed after 21s

### What's Working ✅
1. Edge function receives webhook
2. POST to /api/sessions succeeds
3. SDP answer generated
4. Call pre-accepted
5. Call fully accepted
6. WhatsApp shows call connected

### What's NOT Working ❌
1. No audio heard by user
2. OpenAI not responding
3. Call fails after 21 seconds
4. Session ends immediately

---

## 🐛 Likely Issues

### Issue 1: WebRTC Connection Not Established
**Symptom**: Call connects but no audio flows  
**Cause**: WebRTC peer connection not actually established  
**Why**: The `wrtc` library in Node.js doesn't work the same as browser WebRTC

**Solution Needed**: 
- WhatsApp Cloud API uses HTTPS webhooks with SDP exchange
- The actual WebRTC media needs to flow through ICE/STUN/TURN
- Our current implementation generates SDP but doesn't establish real connection

### Issue 2: OpenAI Realtime API Not Connected
**Symptom**: No AI voice responses  
**Cause**: WebSocket to OpenAI may not be established  
**Check**: Fly.io logs should show "Connected to OpenAI Realtime API"

### Issue 3: Audio Pipeline Not Processing
**Symptom**: No audio resampling happening  
**Cause**: RTCAudioSink/RTCAudioSource not receiving/sending data  
**Why**: No actual RTP packets flowing

---

## 🔧 Immediate Fixes Needed

### Fix 1: Verify OpenAI Connection

Check if OpenAI WebSocket is actually connecting:

```bash
# View Fly.io logs during a call
flyctl logs --app whatsapp-voice-bridge-dark-dew-6515

# Look for:
# ✅ "Connected to OpenAI Realtime API"
# ✅ "Received media track from WhatsApp"
# ❌ Any errors about OpenAI API key
# ❌ WebSocket connection errors
```

### Fix 2: Add More Logging

The VoiceCallSession needs more debug logs to see where it's failing:

```typescript
// In voice-call-session.ts
this.log.info('Step 1: Creating WebRTC peer connection');
this.log.info('Step 2: Setting remote SDP');
this.log.info('Step 3: Creating local SDP');
this.log.info('Step 4: Connecting to OpenAI');
this.log.info('Step 5: Audio pipeline ready');
```

### Fix 3: Check Environment Variables

```bash
# On Fly.io
flyctl secrets list --app whatsapp-voice-bridge-dark-dew-6515

# Should show:
# OPENAI_API_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

---

## 🎯 Root Cause Analysis

### The Real Problem

WhatsApp Cloud API voice calls work differently than expected:

1. **SDP Exchange**: ✅ Working (we generate SDP answer)
2. **WebRTC Media Flow**: ❌ NOT working
   - WhatsApp expects actual WebRTC connection
   - Our Node.js service with `wrtc` may not be handling media correctly
   - ICE candidates may not be exchanged
   - STUN/TURN servers may be needed

3. **Alternative Architecture Needed**:
   ```
   WhatsApp → Direct WebRTC → Media Server (not Node.js)
   OR
   WhatsApp → SIP Gateway → Twilio → OpenAI
   OR
   WhatsApp → Use WhatsApp's direct audio message API (not calls)
   ```

---

## 💡 Recommended Solutions

### Option 1: Add Detailed Logging (Immediate)

Update `voice-call-session.ts` to log every step:

```typescript
async start(): Promise<string> {
  this.log.info({ callId: this.callId }, 'Starting voice call session');
  
  try {
    this.log.info('Step 1: Setting up WebRTC');
    await this.setupWebRTC();
    
    this.log.info('Step 2: Connecting to OpenAI');
    await this.connectToOpenAI();
    
    this.log.info('Step 3: Configuring OpenAI session');
    await this.configureOpenAISession();
    
    this.log.info('Voice call session ready');
    return this.localSDP!;
  } catch (error) {
    this.log.error({ error }, 'Failed to start session');
    throw error;
  }
}
```

### Option 2: Test with Simple Audio (Quick Test)

Instead of WebRTC, test if WhatsApp accepts audio messages:

```typescript
// Send a pre-recorded greeting
const greeting = await textToSpeech("Hi, this is EasyMO AI");
await sendWhatsAppAudioMessage(fromNumber, greeting);
```

### Option 3: Use Twilio for WebRTC (Production Solution)

Twilio has proven WebRTC infrastructure:

```
WhatsApp Call → Webhook → Twilio Programmable Voice
    ↓
Twilio WebSocket → Your Server → OpenAI
```

---

## 🧪 Debug Steps (Do This Now)

### Step 1: Check Fly.io Logs During Call

```bash
# In one terminal, watch logs
flyctl logs --app whatsapp-voice-bridge-dark-dew-6515

# In another, make a WhatsApp call
# Look for errors or missing steps
```

### Step 2: Test the /api/sessions Endpoint

```bash
# Simulate edge function call
curl -X POST https://whatsapp-voice-bridge-dark-dew-6515.fly.dev/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-123",
    "sdpOffer": "v=0\r\no=- 123 456 IN IP4 0.0.0.0\r\ns=test\r\n",
    "from": "1234567890",
    "config": {}
  }'

# Should return sdpAnswer
# Check Fly.io logs for any errors
```

### Step 3: Verify OpenAI API Key

```bash
# Test OpenAI key directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Should list models including gpt-4o-realtime-preview
```

---

## 📊 Expected vs Actual

### Expected Flow
```
1. Call connects ✅
2. WebRTC established ❌
3. OpenAI WebSocket opens ❌
4. User hears greeting ❌
5. User speaks ❌
6. OpenAI responds ❌
7. Conversation continues ❌
```

### Actual Flow
```
1. Call connects ✅
2. SDP exchanged ✅
3. Call "fully connected" ✅
4. **Silence** ❌
5. Call fails after 21s ❌
```

---

## 🚨 Critical Next Steps

1. **Add comprehensive logging** to voice-call-session.ts
2. **Redeploy** to Fly.io
3. **Make test call** and watch logs in real-time
4. **Identify exact failure point**
5. **Fix the specific issue**

---

## 📝 Quick Fix to Try

The most likely issue is that the OpenAI WebSocket isn't connecting. Try this:

```bash
# SSH into Fly.io machine
flyctl ssh console --app whatsapp-voice-bridge-dark-dew-6515

# Test OpenAI from inside
node -e "
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log('Testing OpenAI connection...');
"
```

---

**Status**: 🔍 **DEBUGGING IN PROGRESS**

The integration is close but audio processing isn't working. Need more logs to identify exact failure point.
