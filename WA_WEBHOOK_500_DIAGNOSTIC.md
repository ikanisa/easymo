# WA-WEBHOOK 500 ERROR - DIAGNOSTIC GUIDE

## Current Status
**Deployed**: Version 324 (561.5kB)
**Error**: 500 Internal Server Error
**Improved Logging**: ✅ Deployed

## Error Symptoms
```json
{
  "event": "WEBHOOK_UNHANDLED_ERROR",
  "correlationId": "08fdffba-fe62-4bef-ab47-ae116e7fb99b",
  "path": "/wa-webhook",
  "error": "[object Object]"
}
```

## Likely Root Cause: Missing Environment Variables

The wa-webhook function requires several environment variables that may not be set in Supabase secrets.

### Required Environment Variables:

#### WhatsApp Configuration (REQUIRED):
```bash
WA_PHONE_ID=<your_whatsapp_phone_id>
WA_TOKEN=<your_whatsapp_access_token>
WA_APP_SECRET=<your_whatsapp_app_secret>
WA_VERIFY_TOKEN=<your_verify_token>
```

#### Supabase Configuration (REQUIRED):
```bash
SUPABASE_URL=<auto-provided>
SUPABASE_SERVICE_ROLE_KEY=<auto-provided>
```

#### Optional (with fallbacks):
```bash
WA_BOT_NUMBER_E164=<your_bot_number>
OPENAI_API_KEY=<your_openai_key>
QR_SALT=<random_salt>
```

## Next Error Will Show Details

The updated deployment now includes:
- ✅ Detailed error messages
- ✅ Error type and stack trace
- ✅ Config initialization error handling
- ✅ JSON error responses with details

**Next 500 error will contain**:
```json
{
  "event": "WEBHOOK_UNHANDLED_ERROR",
  "correlationId": "...",
  "path": "/wa-webhook",
  "error": "Missing required env: WA_PHONE_ID/WHATSAPP_PHONE_NUMBER_ID",
  "errorType": "Error",
  "errorStack": "...",
  "errorObject": "{...}"
}
```

OR if config error:
```json
{
  "error": "configuration_error",
  "message": "Missing required env: WA_PHONE_ID/WHATSAPP_PHONE_NUMBER_ID",
  "details": "Missing required environment variables. Check Supabase secrets."
}
```

## How to Fix

### 1. Check Supabase Secrets
```bash
supabase secrets list
```

### 2. Set Missing Secrets
```bash
# WhatsApp Business API credentials
supabase secrets set WA_PHONE_ID=your_phone_id
supabase secrets set WA_TOKEN=your_access_token
supabase secrets set WA_APP_SECRET=your_app_secret
supabase secrets set WA_VERIFY_TOKEN=your_verify_token

# Optional but recommended
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set WA_BOT_NUMBER_E164=+250...
```

### 3. Verify Function Health
```bash
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook/health
```

## Troubleshooting Steps

### Step 1: Wait for Next Error
The next WhatsApp message will trigger the webhook and the new error logs will show the exact issue.

### Step 2: Check Supabase Dashboard
Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions
- Click on `wa-webhook`
- View logs tab
- Look for latest error with full details

### Step 3: Common Issues

**Issue**: Missing WA_PHONE_ID
```
Error: Missing required env: WA_PHONE_ID/WHATSAPP_PHONE_NUMBER_ID
```
**Fix**: Set WhatsApp Phone Number ID from Meta Business

**Issue**: Missing WA_TOKEN
```
Error: Missing required env: WA_TOKEN/WHATSAPP_ACCESS_TOKEN
```
**Fix**: Set WhatsApp Access Token from Meta Business

**Issue**: Missing WA_APP_SECRET
```
Error: Missing required env: WA_APP_SECRET/WHATSAPP_APP_SECRET
```
**Fix**: Set WhatsApp App Secret from Meta Business

**Issue**: Missing SUPABASE_SERVICE_ROLE_KEY
```
Error: Missing required env: WA_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY
```
**Fix**: Usually auto-provided by Supabase, check project settings

## Alternative Diagnosis

### Test with Manual Request
```bash
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response will now include detailed error information.

## Expected Behavior After Fix

Once environment variables are set:
1. ✅ Config initialization succeeds
2. ✅ Webhook processes WhatsApp messages
3. ✅ Returns 200 OK
4. ✅ No more 500 errors

## Files Updated
- `supabase/functions/wa-webhook/index.ts` - Enhanced error logging
- Deployment version: 324
- Bundle size: 561.5kB

---

**Action Required**: The next error will show the exact missing environment variable. Please share the new error log for specific guidance.
