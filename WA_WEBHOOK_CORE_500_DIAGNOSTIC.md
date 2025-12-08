# WA-Webhook-Core 500 Error Diagnostic Guide

## Error Details
- **Time**: 2025-12-08 12:57:53 GMT
- **Status**: 500 Internal Server Error
- **Service**: wa-webhook-core
- **Duration**: 1781ms (1.78 seconds)
- **User Agent**: facebookexternalua (WhatsApp webhook)

## Common Causes of 500 Errors in wa-webhook-core

### 1. Missing Environment Variables
```bash
# Check if all required vars are set
curl -X GET "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/config-check" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Expected response should show all variables as `true`:
```json
{
  "service": "wa-webhook-core",
  "environment": {
    "SUPABASE_URL": true,
    "SUPABASE_SERVICE_ROLE_KEY": true,
    "WA_PHONE_ID": true,
    "WA_TOKEN": true,
    "WA_APP_SECRET": true,
    "WA_VERIFY_TOKEN": true
  },
  "missing": [],
  "warnings": []
}
```

### 2. Import Errors
Check if all shared modules are deployed:
```bash
# List all edge functions
supabase functions list

# Check if _shared folder exists
ls -la supabase/functions/_shared/
```

### 3. Database Connection Issues
```bash
# Test if Supabase client can connect
curl -X GET "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 4. Routing Error
Based on your earlier logs showing 401 errors, the issue might be in the routing logic.

Check `router.ts` line ~274:
```typescript
const forwarded = await forwardToEdgeService(decision, payload, req.headers);
```

This could fail if:
- Target service doesn't exist
- Target service is down
- Missing Authorization header (the 401 issue we identified earlier)

## Immediate Fix: Deploy with Error Logging

1. **Add detailed logging to catch block** (already exists but may need enhancement):
```typescript
// In index.ts around line 276-318
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  
  // Log full error details
  logError("WA_WEBHOOK_CORE_ERROR", { 
    correlationId, 
    message,
    stack,  // ADD THIS
    errorName: err instanceof Error ? err.constructor.name : "UnknownError"
  }, { correlationId });
  
  // ... rest of error handling
}
```

2. **Check Supabase Logs**:
```bash
# Via Supabase Dashboard:
# 1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
# 2. Click: Edge Functions → wa-webhook-core → Logs
# 3. Filter by: status:500 OR level:error
# 4. Look for events: WA_WEBHOOK_CORE_ERROR

# Or via CLI (if available):
supabase functions logs wa-webhook-core
```

## Debugging Steps

### Step 1: Check Recent Deployments
```bash
# Check if wa-webhook-core was recently deployed
# And if deployment was successful

# Check function version
curl -X GET "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health" | jq .
```

### Step 2: Test with Simple Payload
```bash
# Send test webhook to see detailed error
curl -X POST "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=test" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "1234567890",
            "text": { "body": "test" }
          }]
        }
      }]
    }]
  }'
```

### Step 3: Check Downstream Services
The error might be coming from a downstream service that wa-webhook-core is trying to forward to:

```bash
# Check each service health
for service in wa-webhook wa-webhook-mobility wa-webhook-insurance; do
  echo "Checking $service..."
  curl -X GET "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/$service/health" \
    -H "Authorization: Bearer SERVICE_ROLE_KEY"
done
```

## Known Issues from Repository Review

### Issue #1: Missing Authorization Header (401 → 500 cascade)
From earlier analysis, `wa-webhook-core` forwards requests but doesn't include Authorization header.

**File**: `supabase/functions/wa-webhook-core/router.ts`  
**Line**: ~242-250

**Current code**:
```typescript
const forwardHeaders = new Headers(headers);
forwardHeaders.set("X-Routed-From", "wa-webhook-core");
forwardHeaders.set("X-Routed-Service", targetService);
// MISSING: Authorization header!
```

**Fix**:
```typescript
const forwardHeaders = new Headers(headers);
forwardHeaders.set("X-Routed-From", "wa-webhook-core");
forwardHeaders.set("X-Routed-Service", targetService);
forwardHeaders.set("Authorization", `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`);  // ADD THIS
```

### Issue #2: Error Handler Returning 500 Instead of 200
WhatsApp expects 200 response even for errors (to prevent retries).

**File**: `supabase/functions/wa-webhook-core/index.ts`  
**Line**: ~311-318

**Current behavior**: Returns 500 via `errorHandler.handleError()`  
**Expected behavior**: Return 200 with error logged

**Potential fix**:
```typescript
// After DLQ storage, return 200 to Meta
return finalize(
  json({ success: true, queued: true }, { status: 200 }),  // Return 200!
  "wa-webhook-core"
);
```

## Quick Fix Deployment

1. **Fix Authorization Header**:
```bash
# Edit router.ts
vi supabase/functions/wa-webhook-core/router.ts

# Add Authorization header around line 245
# Then deploy:
supabase functions deploy wa-webhook-core
```

2. **Monitor Logs**:
```bash
# Watch for improvements
# Check Supabase Dashboard → Logs
# Look for: WA_CORE_ROUTED with status:200 (not 401 or 500)
```

3. **Verify Fix**:
```bash
# Send test message via WhatsApp
# Check logs for:
✅ CORE_ROUTING_DECISION
✅ WA_CORE_ROUTED (status: 200)
❌ WA_WEBHOOK_CORE_ERROR (should NOT occur)
```

## Expected Log Flow (When Fixed)

```json
[
  { "event": "SERVICE_STARTED", "service": "wa-webhook-core" },
  { "event": "CORE_WEBHOOK_RECEIVED", "payloadType": "object" },
  { "event": "CORE_ROUTING_DECISION", "service": "wa-webhook-mobility", "reason": "keyword" },
  { "event": "WA_CORE_ROUTED", "service": "wa-webhook-mobility", "status": 200 }
]
```

## Support

**If issue persists**:
1. Check Supabase Dashboard logs for stack trace
2. Verify all environment variables are set
3. Test downstream services individually
4. Consider rollback if needed:
   ```bash
   git log --oneline supabase/functions/wa-webhook-core/
   git checkout <previous-commit> supabase/functions/wa-webhook-core/
   supabase functions deploy wa-webhook-core
   ```

---

**Created**: 2025-12-08  
**Status**: Diagnostic Guide  
**Priority**: P0 - CRITICAL (500 errors block all WhatsApp messages)
