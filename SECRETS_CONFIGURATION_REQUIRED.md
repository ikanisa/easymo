# Required Secrets Configuration

## Current Status

✅ **Correctly Configured:**
- `WHATSAPP_APP_SECRET` - Present (code checks both `WA_APP_SECRET` and `WHATSAPP_APP_SECRET`)
- `WHATSAPP_ACCESS_TOKEN` - Present
- `WHATSAPP_PHONE_NUMBER_ID` - Present
- `WHATSAPP_VERIFY_TOKEN` - Present
- `SUPABASE_URL` - Present
- `SUPABASE_SERVICE_ROLE_KEY` - Present

❌ **Missing:**
- `WA_ALLOW_INTERNAL_FORWARD` - **REQUIRED** if requests go through `wa-webhook-core`

## Required Action

### Add Missing Secret

If your webhook requests are routed through `wa-webhook-core` (which forwards to `wa-webhook-mobility`), you **must** add:

```bash
supabase secrets set WA_ALLOW_INTERNAL_FORWARD=true
```

**Why this is needed:**
- When `wa-webhook-core` forwards requests, it re-stringifies the JSON payload
- This changes the body format (whitespace, key ordering) compared to the original WhatsApp request
- The signature verification fails because the body doesn't match what WhatsApp signed
- Setting `WA_ALLOW_INTERNAL_FORWARD=true` allows the target service to bypass signature verification for internal forwards
- **This is safe** because:
  - Signature is already verified in `wa-webhook-core` before forwarding
  - Only internal services can set the `x-wa-internal-forward` header
  - External requests cannot bypass verification

### Verify App Secret

Even though `WHATSAPP_APP_SECRET` is present, verify it matches your WhatsApp Business API App Secret:

1. Go to Meta Developer Portal: https://developers.facebook.com/apps/YOUR_APP_ID/whatsapp-business/wa-settings/
2. Copy the **App Secret** value
3. Verify it matches what's in Supabase (you can't see the value, but you can update it)

If it doesn't match, update it:
```bash
supabase secrets set WHATSAPP_APP_SECRET=your-actual-app-secret-from-meta
```

## Secret Name Reference

The code supports both naming conventions:

| Primary Name | Fallback Name | Status |
|-------------|---------------|--------|
| `WHATSAPP_APP_SECRET` | `WA_APP_SECRET` | ✅ Present |
| `WHATSAPP_ACCESS_TOKEN` | `WA_TOKEN` | ✅ Present |
| `WHATSAPP_PHONE_NUMBER_ID` | `WA_PHONE_ID` | ✅ Present |
| `WHATSAPP_VERIFY_TOKEN` | `WA_VERIFY_TOKEN` | ✅ Present |
| `WA_ALLOW_INTERNAL_FORWARD` | - | ❌ **MISSING** |

## Testing After Configuration

1. **Add the missing secret:**
   ```bash
   supabase secrets set WA_ALLOW_INTERNAL_FORWARD=true
   ```

2. **Deploy the code changes:**
   ```bash
   git push origin main
   ```

3. **Test the webhook:**
   - Send a test message from WhatsApp
   - Check logs for `MOBILITY_SIGNATURE_VALID` or `MOBILITY_AUTH_BYPASS` (for internal forwards)
   - Should NOT see `MOBILITY_SIGNATURE_MISMATCH` anymore

## Expected Log Output

### If requests go through wa-webhook-core:
```json
{
  "event": "MOBILITY_AUTH_BYPASS",
  "reason": "internal_forward"
}
```

### If requests go directly to wa-webhook-mobility:
```json
{
  "event": "MOBILITY_SIGNATURE_VALID",
  "signatureHeader": "x-hub-signature-256",
  "signatureMethod": "sha256"
}
```

## Security Notes

- ✅ `WA_ALLOW_INTERNAL_FORWARD=true` is safe because signature is verified in core first
- ❌ **Never** set `WA_ALLOW_UNSIGNED_WEBHOOKS=true` in production
- ✅ Always verify `WHATSAPP_APP_SECRET` matches Meta's App Secret

