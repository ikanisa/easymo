# WhatsApp Webhook Core Authentication Fix

## Problem
The `wa-webhook-core` edge function was returning **401 Unauthorized** errors because it lacked WhatsApp webhook signature verification for POST requests.

### Error Evidence
```json
{
  "event_message": "POST | 401 | https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core",
  "request": {
    "method": "POST",
    "user_agent": "facebookexternalua",
    "content_length": "725"
  },
  "response": {
    "status_code": 401
  },
  "execution_time_ms": 258
}
```

## Root Cause
The function only validated GET requests (webhook verification handshake) but **skipped authentication** for POST requests (actual webhook events). This violated WhatsApp's security requirements.

**Before (Lines 88-98):**
```typescript
// Webhook ingress (POST)
try {
  const payload = await req.json();  // ❌ No signature verification
  log("CORE_WEBHOOK_RECEIVED", { payloadType: typeof payload });
  const decision = await routeIncomingPayload(payload);
  const forwarded = await forwardToEdgeService(decision, payload, req.headers);
  return finalize(forwarded, decision.service);
}
```

## Solution Implemented
Added HMAC-SHA256 signature verification using the existing `verifyWebhookSignature` utility from `_shared/webhook-utils.ts`.

### Changes Made

**File:** `supabase/functions/wa-webhook-core/index.ts`

1. **Added Import (Line 4):**
```typescript
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
```

2. **Added Authentication Logic (Lines 88-117):**
```typescript
// Webhook ingress (POST)
try {
  // Read raw body for signature verification
  const rawBody = await req.text();
  
  // Verify WhatsApp signature
  const signature = req.headers.get("x-hub-signature-256");
  const appSecret = Deno.env.get("WA_APP_SECRET");
  
  if (!appSecret) {
    log("CORE_AUTH_CONFIG_ERROR", { error: "WA_APP_SECRET not configured" }, "error");
    return json({ error: "server_misconfigured" }, { status: 500 });
  }
  
  const isValid = await verifyWebhookSignature(rawBody, signature, appSecret);
  
  if (!isValid) {
    log("CORE_AUTH_FAILED", { 
      signatureProvided: !!signature,
      userAgent: req.headers.get("user-agent") 
    }, "warn");
    return json({ error: "unauthorized" }, { status: 401 });
  }
  
  // Parse payload after verification
  const payload = JSON.parse(rawBody);
  log("CORE_WEBHOOK_RECEIVED", { payloadType: typeof payload });
  const decision = await routeIncomingPayload(payload);
  const forwarded = await forwardToEdgeService(decision, payload, req.headers);
  return finalize(forwarded, decision.service);
}
```

## Security Features

### 1. **Timing-Safe Comparison**
Uses `timingSafeEqual()` from Deno std library to prevent timing attacks.

### 2. **Signature Format Validation**
Validates `x-hub-signature-256` header format: `sha256=<hex_hash>`

### 3. **HMAC-SHA256 Verification**
Uses Web Crypto API for cryptographic verification:
```typescript
const key = await crypto.subtle.importKey("raw", encoder.encode(appSecret), 
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
```

### 4. **Structured Logging**
- `CORE_AUTH_CONFIG_ERROR` → Missing WA_APP_SECRET (500 response)
- `CORE_AUTH_FAILED` → Invalid signature (401 response)
- Logs correlation IDs for audit trails

## Required Environment Variable

**Critical:** Set this secret in Supabase dashboard:

```bash
WA_APP_SECRET=your_whatsapp_app_secret_from_meta_dashboard
```

### How to Get the Secret:
1. Go to **Meta for Developers** console
2. Navigate to your WhatsApp app
3. Go to **App Settings → Basic**
4. Copy the **App Secret** value

### How to Set in Supabase:
```bash
# Option 1: Supabase CLI
supabase secrets set WA_APP_SECRET=your_secret_here

# Option 2: Dashboard
# Settings → Edge Functions → Secrets → Add Secret
# Name: WA_APP_SECRET
# Value: <paste secret>
```

## Deployment Steps

### 1. **Set Environment Secret**
```bash
supabase secrets set WA_APP_SECRET=<your_whatsapp_app_secret>
```

### 2. **Deploy Updated Function**
```bash
supabase functions deploy wa-webhook-core
```

### 3. **Verify Deployment**
```bash
# Check function logs
supabase functions logs wa-webhook-core

# Test with valid signature
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=<valid_signature>" \
  -d '{"object":"whatsapp_business_account","entry":[]}'
```

### 4. **Monitor for Errors**
Watch for these new log events:
- ✅ `CORE_WEBHOOK_RECEIVED` → Authenticated successfully
- ⚠️ `CORE_AUTH_FAILED` → Invalid signature (check WhatsApp App Secret)
- ❌ `CORE_AUTH_CONFIG_ERROR` → WA_APP_SECRET not set

## Expected Behavior After Fix

### Valid WhatsApp Webhook (200 OK)
```json
{
  "event": "CORE_WEBHOOK_RECEIVED",
  "service": "wa-webhook-core",
  "status": 200
}
```

### Invalid/Missing Signature (401 Unauthorized)
```json
{
  "event": "CORE_AUTH_FAILED",
  "signatureProvided": true,
  "userAgent": "facebookexternalua",
  "status": 401
}
```

### Missing WA_APP_SECRET (500 Internal Error)
```json
{
  "event": "CORE_AUTH_CONFIG_ERROR",
  "error": "WA_APP_SECRET not configured",
  "status": 500
}
```

## Verification Checklist

- [ ] WA_APP_SECRET set in Supabase secrets
- [ ] Function deployed successfully
- [ ] WhatsApp webhooks now return 200 (not 401)
- [ ] Logs show `CORE_WEBHOOK_RECEIVED` events
- [ ] No `CORE_AUTH_FAILED` errors in production
- [ ] Facebook external UA requests authenticated

## Rollback Plan

If issues occur, revert to previous version:
```bash
# Restore previous deployment
git revert <commit_hash>
supabase functions deploy wa-webhook-core

# Or disable signature check temporarily (NOT RECOMMENDED)
# Remove WA_APP_SECRET to return 500 instead of 401
```

## Related Files
- ✅ `supabase/functions/wa-webhook-core/index.ts` (modified)
- 📚 `supabase/functions/_shared/webhook-utils.ts` (used for verification)
- 📚 `supabase/functions/_shared/observability.ts` (logging)

## Testing

### Unit Test (Add to `index.test.ts`):
```typescript
Deno.test("POST without signature returns 401", async () => {
  const req = new Request("http://localhost/", {
    method: "POST",
    body: JSON.stringify({ object: "whatsapp_business_account", entry: [] })
  });
  // Assert 401 response
});

Deno.test("POST with invalid signature returns 401", async () => {
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "x-hub-signature-256": "sha256=invalid" },
    body: JSON.stringify({ object: "whatsapp_business_account", entry: [] })
  });
  // Assert 401 response
});
```

### Integration Test:
```bash
# Send test webhook from WhatsApp Business Platform
# Settings → Webhooks → Test Button → Send Test Event
# Should now return 200 instead of 401
```

## Compliance

✅ **Observability:** Structured logging with correlation IDs  
✅ **Security:** HMAC-SHA256 signature verification, timing-safe comparison  
✅ **Error Handling:** Graceful degradation, proper status codes  
✅ **Feature Flags:** N/A (security fix, always enabled)

## References
- [WhatsApp Webhook Security](https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests)
- [Meta App Secret Location](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings/)
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
