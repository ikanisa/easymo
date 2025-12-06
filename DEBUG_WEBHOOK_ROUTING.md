# WhatsApp Voice Call - Webhook Routing Issue

**Date:** 2025-12-06 22:09 UTC  
**Issue:** No logs when calling from WhatsApp

---

## 🔍 DIAGNOSIS

**Problem:** WhatsApp is NOT sending call webhooks to `wa-webhook-voice-calls`

**Most Likely Cause:** Your main WhatsApp webhook URL is pointing to a DIFFERENT function!

---

## 🎯 THE REAL ISSUE

WhatsApp only allows **ONE webhook URL per app**.

Your webhook is probably pointing to:
- `wa-webhook` (main handler)
- `wa-webhook-core`
- Or some other function

**NOT** to `wa-webhook-voice-calls`!

---

## ✅ SOLUTION

### Option A: Route from Main Webhook (RECOMMENDED)

**The main `wa-webhook` function should route call events to the voice handler.**

Check: Does `wa-webhook/index.ts` handle call events?

### Option B: Change Webhook URL (NOT RECOMMENDED)

Change Facebook webhook to:
```
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-voice-calls
```

But this breaks your message handling!

---

## 🔧 QUICK CHECK

1. **What webhook URL is configured in Facebook Developer Console?**
   - Go to: https://developers.facebook.com/apps
   - Your app → WhatsApp → Configuration → Webhooks
   - **What's the URL?**

2. **Check main webhook logs**
   - Look at `wa-webhook` or `wa-webhook-core` logs
   - Do you see call events there?

---

## 💡 PROPER ARCHITECTURE

```
WhatsApp → Main Webhook (wa-webhook or wa-webhook-core)
              ↓
         [Route by event type]
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
Messages            Calls
(wa-webhook)    (wa-webhook-voice-calls)
```

The main webhook needs to route call events!

---

**NEXT:** Check which webhook URL is configured in Facebook and show me the main webhook code!

