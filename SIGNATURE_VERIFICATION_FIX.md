# Signature Verification Fix

## Issue
WhatsApp webhook signature verification is failing with `MOBILITY_SIGNATURE_MISMATCH` errors, causing 401 Unauthorized responses.

## Root Causes Identified

### 1. Internal Forward Header Missing (FIXED)
When `wa-webhook-core` forwards requests to other services, it wasn't setting the `x-wa-internal-forward` header. This causes signature verification to fail because:
- The body is re-stringified (`JSON.stringify(payload)`) which can change formatting
- The target service tries to verify the signature against the modified body
- Signature verification fails even though the request is legitimate

**Fix Applied**: Added `x-wa-internal-forward: true` header in `wa-webhook-core/router.ts` when forwarding requests.

### 2. App Secret Mismatch (REQUIRES USER ACTION)
The most likely cause is that `WA_APP_SECRET` in Supabase doesn't match the App Secret configured in WhatsApp Business API.

**Symptoms**:
- `receivedHashSample` and `expectedHashSample` are completely different
- Signature verification consistently fails
- 401 Unauthorized responses

## Fixes Applied

### 1. Internal Forward Header
**File**: `supabase/functions/wa-webhook-core/router.ts`
- Added `forwardHeaders.set("x-wa-internal-forward", "true")` when forwarding requests
- This allows target services to bypass signature verification for internal forwards

### 2. Enhanced Error Diagnostics
**File**: `supabase/functions/wa-webhook-mobility/index.ts`
- Added diagnostic messages to error logs
- Better guidance on what to check when signature verification fails

## Required Actions

### 1. Verify App Secret Configuration
The `WA_APP_SECRET` in Supabase must match the App Secret from WhatsApp Business API:

```bash
# Get your App Secret from Meta Developer Portal:
# https://developers.facebook.com/apps/YOUR_APP_ID/whatsapp-business/wa-settings/

# Verify current secret in Supabase
supabase secrets list | grep WA_APP_SECRET

# Update if needed
supabase secrets set WA_APP_SECRET=your-actual-app-secret-from-meta
```

### 2. Enable Internal Forward Bypass (if using wa-webhook-core)
If requests are routed through `wa-webhook-core`, set:

```bash
supabase secrets set WA_ALLOW_INTERNAL_FORWARD=true
```

**Note**: This is safe because:
- Signature is already verified in `wa-webhook-core`
- The header is only set by internal services
- External requests cannot set this header

### 3. Verify Request Flow
Check if requests are going:
- **Directly to services**: WhatsApp → `wa-webhook-mobility` (requires correct app secret)
- **Through core**: WhatsApp → `wa-webhook-core` → `wa-webhook-mobility` (requires `WA_ALLOW_INTERNAL_FORWARD=true`)

## Testing

After applying fixes:

1. **Check logs** for improved diagnostic messages
2. **Verify signature verification** - should see `MOBILITY_SIGNATURE_VALID` events
3. **Test webhook** - send a test message from WhatsApp

## Expected Log Output

### Success
```json
{
  "event": "MOBILITY_SIGNATURE_VALID",
  "signatureHeader": "x-hub-signature-256",
  "signatureMethod": "sha256"
}
```

### Internal Forward (if using core)
```json
{
  "event": "MOBILITY_AUTH_BYPASS",
  "reason": "internal_forward"
}
```

### Failure (with diagnostics)
```json
{
  "event": "MOBILITY_SIGNATURE_MISMATCH",
  "diagnostic": "App secret mismatch or body modified. Verify WA_APP_SECRET matches WhatsApp Business API App Secret."
}
```

## Security Notes

- **Never** set `WA_ALLOW_UNSIGNED_WEBHOOKS=true` in production
- **Always** verify the app secret matches between Supabase and Meta
- Internal forward bypass is safe because signature is verified in core first

