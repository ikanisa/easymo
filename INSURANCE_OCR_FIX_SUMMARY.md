# Insurance OCR Fix Summary

**Date**: 2025-12-07  
**Status**: ✅ FIXED  
**Priority**: 🔴 P0 - Critical

---

## Issues Fixed

### 1. ✅ Duplicate Imports in ocr-processor (P1)
**File**: `supabase/functions/ocr-processor/index.ts`  
**Issue**: Triple duplicate imports of `logStructuredEvent` on lines 2, 4, and 6  
**Impact**: Parser/runtime errors preventing function deployment  

**Fix Applied**:
```typescript
// BEFORE (lines 1-6)
import { IDS } from "../wa-webhook/wa/ids.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { resolveOpenAiResponseText } from "../_shared/wa-webhook-shared/utils/openai_responses.ts";
import { logStructuredEvent } from "../_shared/observability.ts";  // ❌ DUPLICATE
import { SupabaseRest } from "./supabase_rest.ts";
import { logStructuredEvent } from "../_shared/observability.ts";  // ❌ DUPLICATE

// AFTER (lines 1-4)
import { IDS } from "../wa-webhook/wa/ids.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { resolveOpenAiResponseText } from "../_shared/wa-webhook-shared/utils/openai_responses.ts";
import { SupabaseRest } from "./supabase_rest.ts";
```

### 2. ✅ logStructuredEvent Syntax Error (P1)
**File**: `supabase/functions/ocr-processor/index.ts`  
**Line**: 558  
**Issue**: Missing `error:` parameter name in object literal  

**Fix Applied**:
```typescript
// BEFORE (line 558)
await logStructuredEvent("ERROR", { data: "ocr.publish.publish_fail", publishResult.error });
                                                                       ^^^^^^^^^^^^^^^^^^^^
                                                                       ❌ Invalid syntax

// AFTER (line 558)
await logStructuredEvent("ERROR", { data: "ocr.publish.publish_fail", error: publishResult.error });
                                                                       ^^^^^
                                                                       ✅ Named parameter
```

---

## ⚠️ Critical Action Required: API Keys

### Missing OCR Provider API Keys (P0)

**Issue #455**: The insurance-ocr Edge Function returns non-2xx status code without API keys.

**Root Cause**: The OCR function requires **at least one** of these environment variables:
- `OPENAI_API_KEY` - for OpenAI GPT-4o-mini Vision API
- `GEMINI_API_KEY` - for Google Gemini Vision API

**Current Behavior Without Keys**:
```json
{
  "event": "INS_INLINE_OCR_FAIL",
  "error": "no_ocr_provider",
  "status": 503
}
```

**Fix Required**:
```bash
# Check current secrets
supabase secrets list --project-ref <your-project-ref> | grep -E "OPENAI|GEMINI"

# Set OpenAI key (recommended - more reliable)
supabase secrets set OPENAI_API_KEY="sk-your-key-here" --project-ref <your-project-ref>

# OR set Gemini key (alternative)
supabase secrets set GEMINI_API_KEY="AIza-your-key-here" --project-ref <your-project-ref>

# Redeploy after setting secrets
supabase functions deploy insurance-ocr --no-verify-jwt --project-ref <your-project-ref>
```

---

## Deployment Guide

### Quick Deploy (Automated)
```bash
# Set your access token
export SUPABASE_ACCESS_TOKEN="sbp_your_token_here"
export SUPABASE_PROJECT_REF="rweobwuwzswudbgjpdcc"

# Run the fix script (includes deployment)
./fix-insurance-ocr.sh
```

### Manual Deploy
```bash
# Deploy fixed functions
supabase functions deploy ocr-processor --no-verify-jwt
supabase functions deploy insurance-ocr --no-verify-jwt
supabase functions deploy wa-webhook-insurance --no-verify-jwt  # Optional

# Verify deployment
supabase functions logs insurance-ocr --tail
```

---

## Testing After Fix

### Test 1: Via WhatsApp
1. Send an insurance certificate image to the WhatsApp bot
2. Expected response: Confirmation message with extracted details
3. Check logs: `supabase functions logs insurance-ocr --tail`

**Success Indicators**:
```json
{"event": "INS_OCR_OPENAI_CALL", "model": "gpt-4o-mini", "attempt": 1}
{"event": "INS_OCR_OK", "leadId": "uuid-here", "ms": 2500}
{"event": "INSURANCE_UPLOAD_OCR_OK", "wa_id": "...", "lead_id": "..."}
```

**Failure Indicators** (if API keys still missing):
```json
{"event": "INS_INLINE_OCR_FAIL", "error": "no_ocr_provider", "status": 503}
{"event": "INS_FALLBACK_TO_QUEUE", "queueId": "..."}
```

### Test 2: Via Admin Panel
1. Navigate to Insurance Workbench
2. Select a pending document
3. Click "Queue OCR" button
4. Expected: Success message and extracted data displayed

### Test 3: Check Queue Processing
```sql
-- Check insurance_ocr_queue table
SELECT id, status, attempts, last_error 
FROM insurance_ocr_queue 
WHERE status IN ('queued', 'processing', 'retry')
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Circuit Breaker Behavior

### Understanding Circuit Breaker

The OCR system has a circuit breaker pattern to prevent cascading failures:

```typescript
const CIRCUIT_BREAKER_THRESHOLD = 5;      // Opens after 5 consecutive failures
const CIRCUIT_BREAKER_RESET_MS = 60_000;  // 60 seconds cooldown
```

**States**:
- **CLOSED** (Normal): All requests processed
- **OPEN** (Tripped): Blocks all requests for 60 seconds after 5 failures
- **HALF-OPEN** (Testing): After cooldown, allows one test request

**If Circuit is Open**:
1. Wait 60 seconds for automatic reset
2. Send a test request
3. Success → Circuit closes, normal operation resumes
4. Failure → Circuit stays open for another 60 seconds

**Reset Circuit Manually** (if needed):
```bash
# Redeploy the function (clears module-level state)
supabase functions deploy insurance-ocr --no-verify-jwt
```

---

## OCR Processing Flow

```
User uploads insurance document via WhatsApp
                ↓
wa-webhook-insurance receives image
                ↓
Attempts inline OCR processing
     ├── Check: Has OPENAI_API_KEY or GEMINI_API_KEY?
     │      ├── NO → Return 503 "no_ocr_provider" ❌
     │      └── YES → Continue ✅
     ├── Check: Is OpenAI circuit open?
     │      ├── YES → Skip OpenAI
     │      └── NO → Try OpenAI Vision API
     ├── OpenAI failed? → Fallback to Gemini
     └── Both failed? → Queue for retry
                ↓
normalizeInsuranceExtraction(rawOcr)
                ↓
Update insurance_leads table
                ↓
Notify admins + send WhatsApp confirmation
```

---

## Files Modified

| File | Lines Changed | Type |
|------|---------------|------|
| `supabase/functions/ocr-processor/index.ts` | 1-6 | Import cleanup |
| `supabase/functions/ocr-processor/index.ts` | 558 | Syntax fix |

---

## Files Created

| File | Purpose |
|------|---------|
| `fix-insurance-ocr.sh` | Automated deployment script |
| `INSURANCE_OCR_FIX_SUMMARY.md` | This document |

---

## Related Documentation

- **OCR_PROCESSOR_KNOWN_ISSUE.md** - Previous documentation of syntax errors
- **Issue #455** - Missing OCR provider API keys (GitHub)
- **VEHICLE_OCR_FIELD_FIX.md** - Related field mapping fix

---

## Rollback Plan (if needed)

```bash
# Revert to previous version
git checkout HEAD~1 supabase/functions/ocr-processor/index.ts

# Redeploy
supabase functions deploy ocr-processor --no-verify-jwt
supabase functions deploy insurance-ocr --no-verify-jwt
```

---

## Success Metrics

After deployment, monitor these metrics:

1. **OCR Success Rate**: Should be > 90% (was ~0% due to missing keys)
2. **Queue Length**: Should decrease as backlog is processed
3. **Error Rate**: Should see no more `no_ocr_provider` errors
4. **Circuit Breaker Trips**: Should be minimal (only on genuine API failures)

**Monitoring Commands**:
```bash
# Real-time logs
supabase functions logs insurance-ocr --tail

# Check queue backlog
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM insurance_ocr_queue GROUP BY status;"

# Check recent leads
psql $DATABASE_URL -c "SELECT id, ocr_status, created_at FROM insurance_leads ORDER BY created_at DESC LIMIT 10;"
```

---

## Troubleshooting

### Issue: Still seeing "no_ocr_provider"
**Solution**: 
1. Verify secrets are set: `supabase secrets list`
2. Redeploy function: `supabase functions deploy insurance-ocr --no-verify-jwt`
3. Check function logs for API key detection

### Issue: Circuit breaker is open
**Solution**:
1. Wait 60 seconds for automatic reset
2. Or redeploy function to clear state

### Issue: OpenAI API errors
**Solution**:
1. Verify API key is valid and has credits
2. Check OpenAI service status
3. Function will automatically fallback to Gemini if configured

### Issue: Queue not processing
**Solution**:
1. Check insurance-ocr cron job is enabled
2. Manually trigger: `curl -X POST <insurance-ocr-url>?mode=queue`
3. Check queue table for stuck items

---

**Status**: ✅ Code fixes applied, ready for deployment  
**Next Action**: Set OCR provider API keys and deploy functions  
**Deployment Script**: `./fix-insurance-ocr.sh`
