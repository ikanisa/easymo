# Voice Calls Implementation Audit

## Executive Summary
After deep review, the voice calls implementation exists but uses the **wrong integration method**. WhatsApp Business Cloud API voice calls should be routed through OpenAI's SIP Realtime API webhook, not the Sessions API.

## Current Implementation (wa-webhook-voice-calls)

### ✅ What's Working
1. **Webhook handler** properly receives WhatsApp call events (`ringing`, `accepted`, `ended`)
2. **Profile lookup** - fetches user info from database
3. **Multi-language support** - detects preferred language (en/fr/rw)
4. **Error handling** - falls back to text message if voice unavailable
5. **Call tracking** - stores call summaries in database
6. **Structured logging** - comprehensive observability
7. **Signature verification** - validates webhook authenticity

### ❌ What's Wrong
1. **WRONG API ENDPOINT**
   - Current: `POST https://api.openai.com/v1/realtime/sessions`
   - Should be: Webhook receives `realtime.call.incoming` event, then accept via `/realtime/calls/{call_id}/accept`

2. **Missing SIP Configuration**
   - WhatsApp Business Phone Number needs SIP trunk pointing to OpenAI
   - OpenAI needs webhook URL configured to receive incoming calls
   - No SIP URI configuration in the code

3. **Incorrect Response Format**
   - Returns: `{ audio: { url: session.client_secret.value } }`
   - Should return: `200 OK` after accepting call via OpenAI API

## How WhatsApp → OpenAI SIP Actually Works

```
┌─────────────────────────────────────────────────────────────────┐
│  CORRECT FLOW: WhatsApp Business Cloud API + OpenAI SIP        │
└─────────────────────────────────────────────────────────────────┘

1. SETUP (One-time)
   ├─ Purchase WhatsApp Business Phone Number (+250 or +356)
   ├─ Enable voice calls in Facebook Developer Console
   ├─ Configure SIP trunk to route to OpenAI:
   │  sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls
   └─ Set OpenAI webhook: https://your-supabase-project.supabase.co/functions/v1/openai-sip-webhook

2. INCOMING CALL FLOW
   Customer calls WhatsApp number
         ↓
   WhatsApp routes via SIP to OpenAI
         ↓
   OpenAI sends webhook: realtime.call.incoming
         ↓
   Your webhook handler (openai-sip-webhook) receives event
         ↓
   POST https://api.openai.com/v1/realtime/calls/{call_id}/accept
   {
     "type": "realtime",
     "model": "gpt-5-realtime",
     "instructions": "You are EasyMO...",
     "voice": "alloy"
   }
         ↓
   OpenAI connects call to GPT-5 Realtime
         ↓
   Customer talks to AI
         ↓
   Call ends → webhook: realtime.call.ended
```

## What You Already Have

### ✅ Existing Functions
1. **openai-sip-webhook** (`supabase/functions/openai-sip-webhook/index.ts`)
   - **Status**: ✅ Properly implements SIP webhook handler
   - **Lines 154-259**: Handles `realtime.call.incoming` correctly
   - **Line 176-203**: Accepts call with correct API endpoint
   - **Line 185**: ✅ Uses `gpt-5-realtime` (correct model)
   - **Issue**: Duplicate code at lines 297-417 (should be removed)

2. **wa-webhook-voice-calls** (`supabase/functions/wa-webhook-voice-calls/index.ts`)
   - **Status**: ⚠️ Correct structure, wrong API
   - **Should be**: Renamed or repurposed for WhatsApp voice *messages* (async audio)

3. **openai-realtime-sip** (`supabase/functions/openai-realtime-sip/index.ts`)
   - **Status**: ⚠️ MTN-specific implementation
   - **Use case**: Direct MTN SIP trunk (bypassing WhatsApp)

## Recommended Fix

### Option A: Use Existing openai-sip-webhook (RECOMMENDED)
The `openai-sip-webhook` function is **already correctly implemented**. Just:

1. **Clean up duplicate code**
   ```bash
   # Remove lines 297-417 in openai-sip-webhook/index.ts
   ```

2. **Configure OpenAI webhook**
   ```bash
   # In OpenAI Dashboard → Project Settings → Webhooks
   URL: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-sip-webhook
   Events: realtime.call.incoming, realtime.call.ended
   Secret: whsec_7B7U3XqU7ZuFzUvBauNsYDITpdGbPXcIAavH1XtH9d4=
   ```

3. **Configure WhatsApp SIP routing**
   ```
   # In Facebook Developer Console → WhatsApp → Phone Numbers
   SIP URI: sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls
   ```

4. **Deploy**
   ```bash
   supabase functions deploy openai-sip-webhook
   ```

### Option B: Fix wa-webhook-voice-calls
If you want to keep using `wa-webhook-voice-calls` name:

1. **Rename current implementation**
   ```bash
   mv wa-webhook-voice-calls wa-webhook-voice-messages
   ```

2. **Redirect wa-webhook-voice-calls to openai-sip-webhook**
   ```typescript
   // wa-webhook-voice-calls/index.ts
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
   
   serve((req) => {
     const newUrl = new URL(req.url);
     newUrl.pathname = '/openai-sip-webhook';
     return fetch(newUrl, req);
   });
   ```

## Environment Variables Checklist

```bash
# ✅ Already configured (you provided these)
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN
OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU
OPENAI_WEBHOOK_SECRET=whsec_7B7U3XqU7ZuFzUvBauNsYDITpdGbPXcIAavH1XtH9d4=
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17

# ⚠️ Should be updated
OPENAI_REALTIME_MODEL=gpt-5-realtime  # Use GPT-5, not GPT-4o

# ✅ WhatsApp (already configured)
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_APP_SECRET=...
```

## Testing Checklist

### Phase 1: Verify OpenAI Webhook
```bash
# 1. Deploy the function
supabase functions deploy openai-sip-webhook

# 2. Test health endpoint
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-sip-webhook/health

# Expected: {"status":"healthy","service":"openai-sip-webhook"}
```

### Phase 2: Simulate Incoming Call
```bash
# Send test webhook from OpenAI
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-sip-webhook \
  -H "Content-Type: application/json" \
  -H "x-openai-signature: ..." \
  -d '{
    "object": "event",
    "type": "realtime.call.incoming",
    "data": {
      "call_id": "test_call_123",
      "from": "+250788123456",
      "to": "+250788999999"
    }
  }'
```

### Phase 3: Live WhatsApp Call
1. Call your WhatsApp Business number from mobile
2. Verify call is answered by AI
3. Check Supabase logs for `OPENAI_SIP_CALL_ACCEPTED`

## Migration Steps

1. **Remove duplicate code from openai-sip-webhook**
   ```bash
   # Edit supabase/functions/openai-sip-webhook/index.ts
   # Delete lines 297-417
   ```

2. **Update model to GPT-5**
   ```bash
   supabase secrets set OPENAI_REALTIME_MODEL="gpt-5-realtime"
   ```

3. **Deploy**
   ```bash
   supabase functions deploy openai-sip-webhook
   ```

4. **Configure OpenAI Webhook**
   - Go to: https://platform.openai.com/settings/organization/webhooks
   - Add endpoint: `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-sip-webhook`
   - Subscribe to: `realtime.call.incoming`, `realtime.call.ended`
   - Secret: `whsec_7B7U3XqU7ZuFzUvBauNsYDITpdGbPXcIAavH1XtH9d4=`

5. **Configure WhatsApp SIP**
   - Go to: Facebook Developer Console → WhatsApp → Configuration
   - SIP URI: `sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls`

6. **Test live call**

## Quick Reference

| Component | Purpose | Status |
|-----------|---------|--------|
| `openai-sip-webhook` | Handle OpenAI SIP calls | ✅ Ready (needs cleanup) |
| `wa-webhook-voice-calls` | WhatsApp voice messages (async) | ⚠️ Misnamed |
| `openai-realtime-sip` | Direct MTN SIP (no WhatsApp) | ✅ Working |
| `sip-voice-webhook` | Universal SIP handler | ⚠️ Experimental |

## Next Steps

**Immediate (30 min):**
1. Clean up `openai-sip-webhook` (remove duplicate code)
2. Update `OPENAI_REALTIME_MODEL` to `gpt-5-realtime`
3. Deploy: `supabase functions deploy openai-sip-webhook`

**Short-term (1 hour):**
4. Configure OpenAI webhook endpoint
5. Configure WhatsApp SIP routing
6. Test with live call

**Optional (future):**
7. Rename `wa-webhook-voice-calls` to `wa-webhook-voice-messages`
8. Add call recording (with consent)
9. Add call analytics dashboard
