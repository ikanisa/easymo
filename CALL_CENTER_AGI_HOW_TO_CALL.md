# 📞 How Users Initiate Calls to Call Center AGI

## Overview

Users can initiate calls to the Call Center AGI through **two primary channels**: WhatsApp Calls and Regular Phone Calls (SIP). Here's exactly how it works:

---

## 🟢 Method 1: WhatsApp Audio/Voice Calls (Recommended)

### Step-by-Step User Flow:

1. **User Opens WhatsApp**
   - Opens WhatsApp on their phone
   - Goes to chat with EasyMO business number (e.g., +250788000000)

2. **User Makes Voice Call**
   - Taps the **phone icon** 📞 in WhatsApp chat
   - Chooses "Voice Call" (not video)
   - Call connects through WhatsApp's infrastructure

3. **WhatsApp Sends Webhook to EasyMO**
   - WhatsApp Business API detects incoming call
   - Sends webhook notification to: `https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-voice`
   - Webhook includes: caller phone number, call ID, timestamp

4. **EasyMO Routes to Voice Gateway**
   - Webhook handler in `wa-webhook-voice` receives notification
   - Initiates connection to Voice Gateway service
   - Voice Gateway creates OpenAI Realtime session

5. **Call Connects to AGI**
   - OpenAI Realtime API streams audio bidirectionally
   - AGI (Call Center) starts conversation: "Hello, this is EasyMO. How can I help you today?"
   - User speaks naturally, AGI responds in real-time

### Technical Flow:
```
User WhatsApp Call
    ↓
WhatsApp Business API
    ↓
Webhook → wa-webhook-voice (Edge Function)
    ↓
Voice Gateway Service (services/voice-gateway)
    ↓
OpenAI Realtime API (WebSocket)
    ↓
Call Center AGI (with all 20 tools)
    ↓
Supabase Database (tool executions)
```

### Current Implementation Status:

**What Exists:**
- ✅ WhatsApp Business API account configured
- ✅ Voice Gateway service (`services/voice-gateway/`)
- ✅ Voice Bridge service (`services/voice-bridge/`)
- ✅ Call Center AGI with 20 tools
- ✅ Database tables for all operations

**What Needs Setup:**
1. **WhatsApp Voice Webhook:**
   ```bash
   # Configure in Meta Business Manager
   Webhook URL: https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-voice
   Webhook Fields: 
   - messages
   - message_status
   - voice_calls (NEW - need to subscribe)
   ```

2. **Create Voice Webhook Handler:**
   ```typescript
   // supabase/functions/wa-webhook-voice/index.ts
   serve(async (req) => {
     const { entry } = await req.json();
     
     for (const change of entry[0].changes) {
       const call = change.value?.call;
       
       if (call?.status === 'ringing') {
         // Route to Voice Gateway
         await fetch('http://voice-gateway:3000/calls/start', {
           method: 'POST',
           body: JSON.stringify({
             call_id: call.id,
             from: call.from,
             agent_id: 'call_center'
           })
         });
       }
     }
   });
   ```

---

## 📱 Method 2: Regular Phone Calls (SIP/Telecom)

### Step-by-Step User Flow:

1. **User Dials EasyMO Number**
   - User dials dedicated EasyMO number (e.g., +250788000000)
   - Uses regular cellular network (MTN, Airtel, etc.)
   - Standard phone call, no internet required

2. **Telecom Routes to SIP Trunk**
   - Call arrives at MTN/Airtel network
   - Routes to EasyMO's SIP trunk provider
   - SIP provider sends call to Voice Bridge

3. **Voice Bridge Receives Call**
   - `services/voice-bridge` receives SIP INVITE
   - Extracts caller ID, call metadata
   - Forwards to Voice Gateway

4. **Voice Gateway Connects to AGI**
   - Creates OpenAI Realtime session
   - Bridges audio between SIP and OpenAI WebSocket
   - AGI greets caller and starts conversation

5. **Call Flows Through AGI**
   - Same as WhatsApp: AGI uses tools, routes to specialists
   - All operations logged to database
   - Call summary created when call ends

### Technical Flow:
```
User Regular Phone Call
    ↓
MTN/Airtel Network
    ↓
SIP Trunk Provider
    ↓
Voice Bridge (services/voice-bridge)
    ↓
Voice Gateway (services/voice-gateway)
    ↓
OpenAI Realtime API
    ↓
Call Center AGI
    ↓
Supabase Database
```

### Current Implementation Status:

**What Exists:**
- ✅ Voice Bridge service with SIP support
- ✅ Voice Gateway service
- ✅ Call Center AGI ready

**What Needs Setup:**
1. **SIP Trunk Configuration:**
   ```bash
   # Configure in services/voice-bridge/config
   SIP_DOMAIN=sip.easymo.rw
   SIP_USERNAME=callcenter
   SIP_PASSWORD=your-sip-password
   SIP_PROVIDER=mtn-rwanda  # or your provider
   ```

2. **Purchase/Configure Phone Number:**
   - Get dedicated number from MTN/Airtel
   - Point to your SIP endpoint
   - Configure in Voice Bridge

---

## 🔧 Quick Setup Guide

### Option 1: WhatsApp Calls (Easier, Faster)

```bash
# 1. Subscribe to WhatsApp voice webhooks
# In Meta Business Manager → WhatsApp → Webhooks
# Enable: voice_calls, messages, message_status

# 2. Create voice webhook handler
cd supabase/functions
supabase functions new wa-webhook-voice

# 3. Configure webhook URL in Meta
# https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-voice

# 4. Test
# Call your WhatsApp Business number
```

### Option 2: Regular Phone Calls (More Setup)

```bash
# 1. Purchase phone number from carrier
# Contact MTN/Airtel business sales

# 2. Set up SIP trunk
# Configure in Voice Bridge service

# 3. Deploy Voice Bridge
cd services/voice-bridge
npm install
npm run build
npm run deploy

# 4. Test
# Dial your dedicated number
```

---

## 🎯 Recommended Approach

**Start with WhatsApp Calls:**

✅ **Advantages:**
- No carrier setup needed
- Already have WhatsApp Business API
- Users already familiar with WhatsApp
- Lower cost per call
- Rich metadata (profile pics, names)

**Later Add Phone Calls:**
- For users without smartphones
- For areas with poor internet
- For business credibility

---

## 📋 Missing Pieces to Enable Calls

### To Enable WhatsApp Calls:

1. **Create Voice Webhook Handler** ⏱️ 30 mins
   ```bash
   supabase functions new wa-webhook-voice
   # Implement call routing logic
   supabase functions deploy wa-webhook-voice
   ```

2. **Subscribe to Voice Events** ⏱️ 10 mins
   - Meta Business Manager → Webhooks
   - Enable "voice_calls" field
   - Point to wa-webhook-voice endpoint

3. **Test** ⏱️ 5 mins
   - Call WhatsApp Business number
   - Verify AGI answers
   - Test a tool (e.g., "I want a ride")

**Total Time: ~45 minutes**

### To Enable Phone Calls:

1. **Get SIP Credentials** ⏱️ 1-2 days
   - Contact MTN/Airtel
   - Purchase dedicated number
   - Get SIP trunk credentials

2. **Configure Voice Bridge** ⏱️ 1 hour
   - Update SIP config
   - Test connectivity
   - Deploy service

3. **Test** ⏱️ 15 mins
   - Dial number
   - Verify routing
   - Test AGI

**Total Time: 1-2 days**

---

## 💡 User Experience

### What Users Experience:

1. **Initiation:**
   - User: *Calls WhatsApp number or dials phone*
   - Wait: ~2-3 seconds for connection

2. **Greeting:**
   - AGI: "Hello, this is EasyMO. How can I help you today?"
   - User: "I need a ride to Kimironko"

3. **Conversation:**
   - AGI: "I can help you with that. Where are you right now?"
   - User: "I'm at KBC"
   - AGI: *Executes tools* "Great! I've requested a moto for you..."

4. **Completion:**
   - AGI: "Is there anything else I can help you with?"
   - User: "No, thank you"
   - AGI: "Thank you for using EasyMO. Have a great day!"
   - *Call ends, summary logged*

### Voice Quality:
- Natural conversation (OpenAI Realtime)
- Low latency (~500ms)
- Supports interruptions
- Multi-language (EN/FR/RW/SW)

---

## 🔍 Implementation Checklist

### WhatsApp Voice Calls:
- [ ] Create `wa-webhook-voice` edge function
- [ ] Subscribe to WhatsApp voice_calls webhook
- [ ] Configure Voice Gateway to receive calls
- [ ] Test end-to-end call flow
- [ ] Monitor call quality

### Phone Calls (Optional):
- [ ] Purchase dedicated phone number
- [ ] Configure SIP trunk
- [ ] Deploy Voice Bridge service
- [ ] Test SIP connectivity
- [ ] Monitor call routing

### Both Channels:
- [x] Call Center AGI implemented ✅
- [x] Database tables created ✅
- [x] Tools ready (20/20) ✅
- [ ] Voice Gateway configured
- [ ] OpenAI Realtime API key
- [ ] Call monitoring dashboard

---

## 📞 Quick Test Script

Once setup is complete:

```bash
# Test WhatsApp call
# 1. Call your WhatsApp Business number from your phone
# 2. Speak: "Hello, I need help"
# 3. Verify AGI responds

# Test phone call
# 1. Dial your dedicated number
# 2. Speak: "I want to register my business"
# 3. Verify AGI responds

# Check database
psql $DATABASE_URL -c "SELECT * FROM call_summaries ORDER BY created_at DESC LIMIT 5;"
```

---

## 🎉 Summary

**How Users Initiate Calls:**

1. **WhatsApp:** Call the WhatsApp Business number (like calling a contact)
2. **Phone:** Dial the dedicated EasyMO phone number

**What's Already Built:**
- ✅ Call Center AGI (100% complete)
- ✅ All 20 tools
- ✅ Database tables
- ✅ Voice infrastructure (services/voice-gateway, voice-bridge)

**What You Need to Do:**
- Create voice webhook handler (~30 mins)
- Configure WhatsApp voice webhooks (~10 mins)
- Test calls (~5 mins)

**Then users can call and the AGI handles everything automatically!** 🚀

---

**Next Step:** Create the `wa-webhook-voice` edge function to route incoming calls to the AGI.

Would you like me to implement the voice webhook handler now?
