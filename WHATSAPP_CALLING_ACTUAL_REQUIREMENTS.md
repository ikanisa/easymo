# WhatsApp Business Cloud API Calling - ACTUAL Requirements

**Date:** 2025-12-06 21:57 UTC  
**Source:** Official WhatsApp Business Platform Documentation

---

## ✅ ACTUAL Prerequisites (From Official Docs)

### Step 1: Prerequisites

Before you can use WhatsApp Calling API:

1. ✅ **Business number in use with Cloud API** (not WhatsApp Business app)
   - You have this ✅

2. ✅ **Subscribe app to `calls` webhook field**
   - **THIS IS MISSING!** ❌
   - Your webhook is probably only subscribed to `messages`

3. ✅ **App subscribed to WhatsApp Business Account**
   - You have this ✅

4. ✅ **Messaging permissions** (`whatsapp_business_messaging`)
   - You have this ✅

5. ❓ **Messaging limit of at least 2000 business-initiated conversations**
   - Need to check your account tier

6. ❌ **Enable Calling features on your business phone number**
   - **THIS IS LIKELY MISSING!** ❌

---

## 🔴 THE ACTUAL ISSUE

Based on the official documentation, you're missing **TWO critical configurations**:

### 1. Webhook NOT Subscribed to `calls` Field ❌

Your Facebook Developer Console webhook is probably only subscribed to:
- ✅ `messages`
- ✅ `message_status`

But **NOT** subscribed to:
- ❌ `calls` (REQUIRED!)

### 2. Calling Features NOT Enabled on Phone Number ❌

Quote from docs:
> "Enable Calling features on your business phone number"

This is a **phone number setting** in your WhatsApp Business configuration.

---

## 🔧 HOW TO FIX

### Fix 1: Subscribe Webhook to `calls` Field

**Go to Facebook Developer Console:**
1. Navigate to your app
2. Go to **WhatsApp** → **Configuration**
3. Find **Webhook** section
4. Click **Edit** or **Subscribe to fields**
5. **CHECK** the box for:
   - ☑️ `calls` (THIS IS THE KEY!)
6. Save

**Webhook URL stays the same:**
```
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-voice-calls
```

### Fix 2: Enable Calling on Your Business Phone Number

**In WhatsApp Business Manager or Developer Console:**
1. Go to **Phone Numbers**
2. Select your business number
3. Look for **Call Settings** or **Calling Features**
4. **Enable** calling
5. Configure optional settings:
   - Inbound call control
   - Business call hours
   - Callback requests

---

## 📋 Call Flow (User-Initiated)

From official docs:

```
1. WhatsApp user taps call → Your webhook receives "connect" event
   {
     "calls": [{
       "event": "connect",
       "session": {
         "sdp_type": "offer",
         "sdp": "<<SDP>>"
       }
     }]
   }

2. Your webhook responds with "pre_accept" (recommended)
   POST /<PHONE_NUMBER_ID>/calls
   {
     "call_id": "...",
     "action": "pre_accept",
     "session": {
       "sdp_type": "answer",
       "sdp": "<<SDP>>"
     }
   }

3. After WebRTC connection, send "accept"
   POST /<PHONE_NUMBER_ID>/calls
   {
     "call_id": "...",
     "action": "accept",
     "session": {
       "sdp_type": "answer",
       "sdp": "<<SDP>>"
     }
   }

4. Call connected - media flows
```

---

## 🎯 CRITICAL DIFFERENCE

**WhatsApp Cloud API Calling uses WebRTC**, NOT OpenAI Realtime API directly!

The correct flow is:
```
WhatsApp → Your Webhook → WebRTC SDP Exchange → Your Media Server/AI
```

**NOT:**
```
WhatsApp → OpenAI Realtime (this doesn't exist for WhatsApp)
```

---

## 🚨 YOUR CODE NEEDS MAJOR CHANGES

Your current `wa-webhook-voice-calls` implementation tries to use OpenAI Realtime directly, but **WhatsApp requires WebRTC SDP handling**.

### What's Needed:

1. **WebRTC SDP handling** (Session Description Protocol)
2. **Media server** to handle audio streams
3. **Connect media to OpenAI Realtime** as a separate step

This is MORE COMPLEX than I initially implemented!

---

## 📊 Two Options

### Option 1: Full WebRTC Implementation (Complex)

**Requirements:**
- WebRTC media server (Janus, Kurento, or custom)
- SDP offer/answer handling
- Audio stream processing
- Connect to OpenAI Realtime

**Complexity:** HIGH  
**Time:** Several days to implement properly

### Option 2: Use SIP Calling Instead (Simple)

**Requirements:**
- SIP trunk (MTN/GO)
- OpenAI SIP Realtime (already configured!)
- No WebRTC needed

**Complexity:** LOW  
**Time:** Already deployed! Just need SIP trunk

---

## ✅ What You Should Do NOW

### Immediate Actions:

1. **Subscribe webhook to `calls` field** in Facebook Developer Console
2. **Enable calling** on your business phone number
3. **Test** if webhook receives call events (it should now)

### Then Decide:

**Path A: Implement WebRTC for WhatsApp**
- Requires WebRTC media server
- Complex but enables WhatsApp calling

**Path B: Focus on SIP calling**
- Already 100% implemented ✅
- Just need MTN/GO SIP trunk
- Simpler and ready to go

---

## 🎯 RECOMMENDATION

**Use SIP Phone Calls (OpenAI SIP Realtime)**

Why:
- ✅ Already fully implemented
- ✅ No WebRTC complexity
- ✅ Direct OpenAI Realtime integration
- ✅ Just needs SIP trunk from MTN/GO
- ✅ Works with any phone (not just WhatsApp)

WhatsApp calling requires WebRTC implementation which is significantly more complex.

---

**Bottom Line:** I apologize for the confusion. WhatsApp Cloud API Calling requires WebRTC, which is different from what I implemented. Your best path forward is SIP calling via MTN/GO, which is already ready!

---

**Created:** 2025-12-06 21:57 UTC  
**Source:** Official WhatsApp Business Platform Docs
