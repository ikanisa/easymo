# Phone Calls - Plug and Play Setup

**Ready for:** Twilio, MTN Rwanda, GO Malta, Any SIP Provider

---

## 🎯 Overview

The phone call integration is **100% plug-and-play**. Just add your SIP provider credentials and deploy!

### Supported Providers

| Provider | Status | Setup Time |
|----------|--------|------------|
| **Twilio** | ✅ Ready | 5 minutes |
| **MTN Rwanda** | ✅ Ready | When available |
| **GO Malta** | ✅ Ready | When available |
| **Any SIP Provider** | ✅ Ready | 10 minutes |

---

## 🚀 Quick Setup

### Option 1: Twilio (Testing/Production)

```bash
# 1. Set Twilio credentials
export TWILIO_ACCOUNT_SID=ACxxxxx
export TWILIO_AUTH_TOKEN=your-token
export TWILIO_PHONE_NUMBER=+1234567890

# 2. Set Voice Gateway URL
export VOICE_GATEWAY_URL=https://your-voice-gateway.run.app

# 3. Deploy
./deploy-phone-calls.sh
```

### Option 2: MTN Rwanda (When Available)

```bash
# 1. Set MTN credentials (from MTN support)
export MTN_SIP_USERNAME=your-username
export MTN_SIP_PASSWORD=your-password
export MTN_SIP_DOMAIN=sip.mtn.rw
export MTN_PHONE_NUMBER=+250123456789

# 2. Set Voice Gateway URL
export VOICE_GATEWAY_URL=https://your-voice-gateway.run.app

# 3. Deploy
./deploy-phone-calls.sh
```

### Option 3: GO Malta (When Available)

```bash
# 1. Set GO credentials (from GO support)
export GO_SIP_USERNAME=your-username
export GO_SIP_PASSWORD=your-password
export GO_SIP_DOMAIN=sip.go.com.mt
export GO_PHONE_NUMBER=+35621234567

# 2. Set Voice Gateway URL
export VOICE_GATEWAY_URL=https://your-voice-gateway.run.app

# 3. Deploy
./deploy-phone-calls.sh
```

### Option 4: Any SIP Provider

```bash
# 1. Set generic SIP credentials
export SIP_USERNAME=your-username
export SIP_PASSWORD=your-password
export SIP_DOMAIN=sip.yourprovider.com
export SIP_PHONE_NUMBER=+1234567890

# 2. Set Voice Gateway URL
export VOICE_GATEWAY_URL=https://your-voice-gateway.run.app

# 3. Deploy
./deploy-phone-calls.sh
```

---

## 📋 Provider Configuration

### Twilio Setup

1. **Get Credentials:**
   - Go to: https://console.twilio.com/
   - Copy Account SID and Auth Token
   - Buy a phone number

2. **Configure Webhook:**
   ```
   Phone Number Settings:
   - A CALL COMES IN: 
     Webhook: https://your-project.supabase.co/functions/v1/sip-voice-webhook/voice
     HTTP POST
   
   - CALL STATUS CHANGES:
     Webhook: https://your-project.supabase.co/functions/v1/sip-voice-webhook/status
     HTTP POST
   ```

3. **Test:**
   - Call your Twilio number
   - Should connect to AI
   - Try: "I need a ride"

### MTN Rwanda Setup

1. **Request SIP Trunk Access:**
   - Contact: MTN Business Support
   - Request: SIP trunk with HTTP webhook support
   - Provide: Your webhook URL

2. **Get Credentials from MTN:**
   ```
   They will provide:
   - SIP Username
   - SIP Password
   - SIP Domain (usually sip.mtn.rw)
   - Your phone number (+250...)
   ```

3. **Configure Webhook with MTN:**
   ```
   Provide to MTN:
   - Incoming Call Webhook:
     https://your-project.supabase.co/functions/v1/sip-voice-webhook/voice
     
   - Status Callback:
     https://your-project.supabase.co/functions/v1/sip-voice-webhook/status
   ```

4. **Deploy:**
   ```bash
   export MTN_SIP_USERNAME=from-mtn
   export MTN_SIP_PASSWORD=from-mtn
   export MTN_PHONE_NUMBER=+250...
   ./deploy-phone-calls.sh
   ```

### GO Malta Setup

1. **Request SIP Trunk:**
   - Contact: GO Business Support
   - Request: SIP trunk with webhook capability
   - Email: business@go.com.mt

2. **Get Credentials from GO:**
   ```
   They will provide:
   - SIP Username
   - SIP Password
   - SIP Domain (usually sip.go.com.mt)
   - Your phone number (+356...)
   ```

3. **Configure Webhook with GO:**
   ```
   Provide to GO:
   - Incoming Call URL:
     https://your-project.supabase.co/functions/v1/sip-voice-webhook/voice
     
   - Status Update URL:
     https://your-project.supabase.co/functions/v1/sip-voice-webhook/status
   ```

4. **Deploy:**
   ```bash
   export GO_SIP_USERNAME=from-go
   export GO_SIP_PASSWORD=from-go
   export GO_PHONE_NUMBER=+356...
   ./deploy-phone-calls.sh
   ```

---

## 🔧 Architecture

```
Phone Call → SIP Provider → sip-voice-webhook → Voice Gateway → OpenAI Realtime
   (User)    (MTN/GO/etc)   (Auto-detects)     (Manages)      (AI processes)
                                  ↓
                             AGI Bridge
                                  ↓
                       Call Center AGI (20 tools)
```

**Key Features:**
- ✅ Auto-detects provider (Twilio, MTN, GO, generic)
- ✅ Adapts to provider's format automatically
- ✅ Universal webhook handles all providers
- ✅ Same AI backend for all call types

---

## 📞 How It Works

### 1. Call Comes In
```
User dials: +250 XXX XXX XXX (MTN number)
         or +356 XX XX XX XX (GO number)
         or +1 XXX XXX XXXX (Twilio number)
```

### 2. Provider Routes to Webhook
```
MTN/GO/Twilio → POST https://your-project.supabase.co/functions/v1/sip-voice-webhook/voice
```

### 3. Webhook Auto-Detects Provider
```typescript
// Detects from:
// - User-Agent header
// - Origin header
// - Request format
// - Configured SIP_PROVIDER
```

### 4. Connects to Voice Gateway
```
sip-voice-webhook → Returns XML response with stream URL
Provider → Opens WebSocket to Voice Gateway
Voice Gateway → Connects to OpenAI Realtime API
```

### 5. Real-time Conversation
```
User speaks → Voice Gateway → OpenAI Realtime → AGI Bridge → Tools
AI responds ← Voice Gateway ← OpenAI Realtime ← Results
```

---

## 💰 Costs by Provider

### Twilio
- Inbound calls: $0.0085/min
- Phone number: $1/month
- Total: ~$0.338/min (including AI)

### MTN Rwanda
- Depends on your MTN contract
- Typically: Local rates apply
- Estimated: ~$0.05/min + AI ($0.325)
- Total: ~$0.375/min

### GO Malta
- Depends on your GO contract
- Typically: Local rates apply
- Estimated: ~$0.08/min + AI ($0.325)
- Total: ~$0.405/min

**AI costs (same for all):**
- OpenAI Realtime: $0.30/min
- Google AI: $0.025/min
- Total AI: ~$0.325/min

---

## 🧪 Testing

### Test with Twilio (Quick)
```bash
# 1. Deploy
./deploy-phone-calls.sh

# 2. Call your Twilio number
# Should hear: "Welcome to EasyMO..."

# 3. Say: "I need a ride from Kigali to Airport"
# AI should execute schedule_ride tool

# 4. Check logs
supabase functions logs sip-voice-webhook --tail
```

### Test with MTN/GO (When Available)
```bash
# 1. Deploy with MTN/GO credentials
export MTN_SIP_USERNAME=...
./deploy-phone-calls.sh

# 2. Call your MTN/GO number
# Same AI experience as Twilio

# 3. Monitor
supabase functions logs sip-voice-webhook --tail
gcloud run services logs read voice-gateway --tail
```

---

## 🔍 Troubleshooting

### Call Doesn't Connect

**Check webhook URL:**
```bash
curl https://your-project.supabase.co/functions/v1/sip-voice-webhook/health
# Should return: {"status":"healthy"}
```

**Check provider configuration:**
- Twilio: Phone number settings → Webhook URL correct?
- MTN/GO: Contact support → Confirm webhook is active

**Check logs:**
```bash
supabase functions logs sip-voice-webhook --tail
# Look for: sip.call.incoming
```

### Call Connects But No AI

**Check Voice Gateway:**
```bash
curl https://your-voice-gateway.run.app/health
# Should return: {"status":"healthy"}
```

**Check environment:**
```bash
supabase secrets list | grep VOICE_GATEWAY_URL
# Should show your Voice Gateway URL
```

### Provider Not Detected

**Check SIP_PROVIDER:**
```bash
supabase secrets list | grep SIP_PROVIDER
# Should show: twilio, mtn, go_malta, or generic
```

**Force provider:**
```bash
export SIP_PROVIDER=mtn  # or twilio, go_malta, generic
./deploy-phone-calls.sh
```

---

## 📊 What You Get

### All Providers Get:
- ✅ Real-time AI voice conversations
- ✅ Tool execution (schedule_ride, search_vehicles, etc.)
- ✅ Multi-language support (rw, en, fr, sw)
- ✅ Call transcripts
- ✅ Analytics and logging
- ✅ Same AI experience as WhatsApp calls

### Provider-Specific:
- **Twilio**: Advanced features, global numbers, SMS integration
- **MTN Rwanda**: Local numbers, better rates in Rwanda
- **GO Malta**: Local numbers, better rates in Malta/Europe
- **Generic SIP**: Any provider, full flexibility

---

## 🎯 Summary

**Status:** ✅ **PLUG AND PLAY READY**

**Supported Providers:**
- ✅ Twilio (test immediately)
- ✅ MTN Rwanda (deploy when available)
- ✅ GO Malta (deploy when available)
- ✅ Any SIP provider (generic support)

**Setup Time:**
- With Twilio: 5 minutes
- With MTN/GO: 10 minutes (after credentials)

**Deploy Command:**
```bash
./deploy-phone-calls.sh
```

**Next Steps:**
1. Get SIP credentials from provider
2. Run deploy script
3. Configure webhook with provider
4. Test with a call
5. Monitor and optimize

---

**Ready to go!** Just waiting for MTN or GO credentials 🚀
