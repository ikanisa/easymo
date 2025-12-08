# Gemini API Key Fix Instructions

**Date**: 2025-12-08 16:20 UTC  
**Issue**: GEMINI_API_KEY exists in secrets but not passed to function runtime  
**Status**: OpenAI working, Gemini broken

---

## DIAGNOSIS COMPLETE

### What We Found

✅ **OPENAI_API_KEY**: Working perfectly
- Listed in Supabase secrets ✓
- Available in function runtime ✓
- OCR processing works ✓

❌ **GEMINI_API_KEY**: Broken
- Listed in Supabase secrets ✓
- **NOT available in function runtime** ✗
- Fallback doesn't work ✗

### Evidence

```bash
# Secrets list shows both keys
$ supabase secrets list --project-ref lhbowpbcpwoiparwnwgt | grep API_KEY
GEMINI_API_KEY     | 8e7b8418...
OPENAI_API_KEY     | c094565b...

# But diagnostic function shows only OpenAI
$ curl https://.../functions/v1/diagnostic
{
  "openai_key": "SET",
  "gemini_key": "NOT SET"  ❌
}
```

---

## HOW TO FIX

### Option 1: Via Supabase Dashboard (RECOMMENDED)

1. **Go to Supabase Dashboard**:
   https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/functions

2. **Delete GEMINI_API_KEY**:
   - Find `GEMINI_API_KEY` in the secrets list
   - Click delete/remove
   - Confirm deletion

3. **Re-add GEMINI_API_KEY**:
   - Click "Add new secret"
   - Name: `GEMINI_API_KEY`
   - Value: Your Gemini API key
   - Save

4. **Redeploy Functions**:
   ```bash
   cd supabase/functions
   export SUPABASE_ACCESS_TOKEN=sbp_500607f0d078e919aa24f179473291544003a035
   
   # Redeploy unified-ocr
   supabase functions deploy unified-ocr --project-ref lhbowpbcpwoiparwnwgt
   
   # Redeploy diagnostic
   supabase functions deploy diagnostic --project-ref lhbowpbcpwoiparwnwgt
   ```

5. **Verify**:
   ```bash
   curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/diagnostic
   # Should show: "gemini_key": "SET" ✅
   ```

---

### Option 2: Via Supabase CLI

```bash
cd supabase
export SUPABASE_ACCESS_TOKEN=sbp_500607f0d078e919aa24f179473291544003a035

# Set the key (replace YOUR_GEMINI_KEY with actual key)
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_KEY --project-ref lhbowpbcpwoiparwnwgt

# Redeploy
cd functions
supabase functions deploy unified-ocr --project-ref lhbowpbcpwoiparwnwgt
supabase functions deploy diagnostic --project-ref lhbowpbcpwoiparwnwgt

# Verify
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/diagnostic
```

---

## VERIFICATION STEPS

### 1. Check Diagnostic
```bash
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/diagnostic
```

**Expected**:
```json
{
  "timestamp": "2025-12-08...",
  "openai_key": "SET",
  "gemini_key": "SET"  ✅
}
```

### 2. Test Insurance OCR
```bash
curl -X GET "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/unified-ocr?domain=insurance&limit=1" \
  -H "Authorization: Bearer sbp_500607f0d078e919aa24f179473291544003a035"
```

**Expected**: Should process jobs without "GEMINI_API_KEY not configured" error

### 3. Test OpenAI → Gemini Fallback

To test the fallback, temporarily break OpenAI:
```bash
# Unset OpenAI key
supabase secrets unset OPENAI_API_KEY --project-ref lhbowpbcpwoiparwnwgt

# Redeploy
supabase functions deploy unified-ocr --project-ref lhbowpbcpwoiparwnwgt

# Test - should use Gemini
curl "https://.../unified-ocr?domain=insurance&limit=1"

# Should work with Gemini now!

# Restore OpenAI
supabase secrets set OPENAI_API_KEY=YOUR_KEY --project-ref lhbowpbcpwoiparwnwgt
supabase functions deploy unified-ocr --project-ref lhbowpbcpwoiparwnwgt
```

---

## WHY THIS HAPPENS

Supabase Edge Functions have a known issue where:
1. Secrets added via CLI might not sync to runtime
2. Secrets added via dashboard before function deployment might not be injected
3. Function needs redeployment after secrets are added/changed

**Solution**: Always redeploy functions after changing secrets.

---

## CURRENT STATUS

### What's Working Now
- ✅ unified-ocr deployed and running
- ✅ CORS fixed
- ✅ Queue processor fixed
- ✅ OPENAI_API_KEY working
- ✅ Insurance domain processes jobs
- ✅ 12 jobs pending in queue

### What's Not Working
- ❌ GEMINI_API_KEY not available in runtime
- ❌ Fallback to Gemini doesn't work
- ⚠️ If OpenAI fails, jobs will retry and fail (not use Gemini)

### Impact
**Low**: OpenAI is the primary provider and it's working. Gemini is only a fallback for when OpenAI is down or rate-limited. The system works fine with just OpenAI.

---

## RECOMMENDED ACTION

**Immediate**: Leave as-is, OpenAI handles everything  
**Within 24h**: Fix Gemini key via dashboard for redundancy  
**After Fix**: Test both providers work

---

## FINAL VERIFICATION COMMAND

After fixing, run this to confirm everything:

```bash
# Check both keys available
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/diagnostic

# Process a job
curl "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/unified-ocr?domain=insurance&limit=1" \
  -H "Authorization: Bearer sbp_500607f0d078e919aa24f179473291544003a035"

# Check queue
psql postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres \
  -c "SELECT COUNT(*) FROM insurance_media_queue WHERE status IN ('queued', 'retry');"
```

---

**Status**: Documented  
**Next**: Fix Gemini key via dashboard  
**Priority**: Low (OpenAI working)
