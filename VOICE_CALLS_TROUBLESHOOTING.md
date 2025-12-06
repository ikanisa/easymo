# 🔧 Voice Calls Troubleshooting

**Issue:** No logs when calling WhatsApp voice call  
**Date:** 2025-12-06 21:46 UTC

---

## ❌ **Problem Identified**

WhatsApp Business API **voice calls are NOT enabled** in your Facebook Developer account, OR the webhook is not configured for voice call events.

---

## 🔍 **Why No Logs?**

The Edge Function `wa-webhook-voice-calls` is deployed and working, but WhatsApp is **not sending call events** to it because:

1. **Voice calls not enabled** in Facebook Developer Console
2. **Webhook not subscribed** to `calls` events
3. **Or using the wrong webhook URL**

---

## ✅ **Solution: Configure WhatsApp Business API**

### Step 1: Go to Facebook Developer Console

1. Visit: https://developers.facebook.com/
2. Go to **My Apps** → Select your EasyMO app
3. Navigate to **WhatsApp** → **Configuration**

### Step 2: Enable Voice Calls

Look for **Voice Calls** settings:
- **Status:** Must be ENABLED
- **Webhook URL:** Must point to your endpoint

**Important:** Voice calls require **WhatsApp Business Platform tier upgrade** (not available on free tier)

### Step 3: Configure Webhook for Calls

1. In **WhatsApp** → **Configuration**
2. Find **Webhook** section
3. Click **Edit**
4. **Subscribe to:**
   - ✅ `calls` (MUST be checked)
   - ✅ `messages` (already have)
   - ✅ `message_status` (already have)

### Step 4: Set Webhook URL

**Current URL (check if this is set):**
```
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-voice-calls
```

**Verify Token:**
```
Your WA_VERIFY_TOKEN from Supabase secrets
```

---

## 🚨 **CRITICAL: WhatsApp Voice Calls Limitation**

### Voice Calls Availability

WhatsApp Business API voice calls are:
- ❌ **NOT available on free tier**
- ❌ **NOT available in all countries**
- ✅ **Available only with Business Solution Provider (BSP)**
- ✅ **Requires special approval from Meta**

### Current Status Check

Run this to check your WhatsApp configuration:
```bash
# Get your WhatsApp phone number details
curl -X GET "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

Look for:
```json
{
  "voice_calls": "enabled"  // <-- Must be "enabled"
}
```

---

## 🔄 **Alternative: Check if You Have Voice Access**

### Test 1: Check WhatsApp Business Account Tier

```bash
# Check your account capabilities
curl -X GET "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/whatsapp_business_profile" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

### Test 2: Try Voice Call API Directly

```bash
# Attempt to initiate a voice call via API
curl -X POST "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "250788123456",
    "type": "call",
    "call": {
      "action": "initiate"
    }
  }'
```

If you get error:
```json
{
  "error": {
    "message": "Voice calls not enabled",
    "code": 100
  }
}
```

**Then voice calls are NOT enabled for your account.**

---

## ✅ **What's Actually Working**

Your setup is CORRECT:
- ✅ Edge Function deployed (wa-webhook-voice-calls v60)
- ✅ GPT-5 Realtime configured
- ✅ All OpenAI secrets set
- ✅ Code is ready and working

**The issue is WhatsApp Business API account configuration, not your code!**

---

## 🎯 **Immediate Solutions**

### Option 1: Enable Voice Calls (If Available)

Contact your **WhatsApp Business Solution Provider (BSP)** to:
1. Upgrade to tier that supports voice calls
2. Enable voice calls for your number
3. Subscribe webhook to `calls` events

### Option 2: Use WhatsApp Voice Messages (Already Working!)

Instead of **voice calls**, use **voice messages** which ARE available:

**Your users can:**
1. Send voice message → Your AI responds with voice message
2. This already works with your deployed functions!

**Functions already deployed:**
- `wa-agent-call-center` (v46) - Handles voice messages ✅

### Option 3: Use Phone Calls via SIP (When Ready)

Use regular phone calls instead:
- Works with MTN Rwanda / GO Malta
- Already deployed and configured
- Just needs SIP trunk contracts

---

## �� **Next Steps**

### Immediate
1. **Check** if voice calls are enabled in Facebook Developer Console
2. **Contact** your WhatsApp BSP about voice call availability
3. **Test** voice messages instead (already working)

### If Voice Calls Not Available
1. **Use voice messages** (bidirectional audio messages)
2. **Use SIP phone calls** (when MTN/GO ready)
3. **Request** voice call access from Meta/BSP

---

## 🔍 **Debug Commands**

```bash
# Check deployed functions
supabase functions list | grep voice

# Test webhook endpoint manually
curl -X POST "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-voice-calls" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "calls": [{
            "status": "ringing",
            "id": "test123",
            "from": "+250788123456",
            "to": "+250788000000"
          }]
        }
      }]
    }]
  }'

# Should return: {"success":true,"call_id":"test123"}
```

---

## 📞 **Contact WhatsApp Business Support**

Ask about:
1. Is voice calling enabled for my account?
2. What tier do I need for voice calls?
3. How to subscribe webhook to `calls` events?
4. What are the requirements for voice call access?

---

**TL;DR:** Your code is correct and deployed. The issue is that WhatsApp Business API voice calls need to be **enabled in your Facebook Developer account** and may require **tier upgrade/special approval**.

---

**Created:** 2025-12-06 21:46 UTC  
**Status:** Awaiting WhatsApp Business configuration
