# 🔧 Insurance OCR Fix - START HERE

**Status**: ✅ Code fixes applied, ready for deployment  
**Date**: 2025-12-07  
**Priority**: 🔴 Critical - OCR not working without API keys

---

## ⚡ Quick Start (5 minutes)

```bash
# 1. Set your Supabase credentials
export SUPABASE_ACCESS_TOKEN="sbp_your_token_here"
export SUPABASE_PROJECT_REF="rweobwuwzswudbgjpdcc"  # or your project ref

# 2. Run the automated fix script
./fix-insurance-ocr.sh

# The script will:
# - Prompt you for OCR provider API keys (REQUIRED)
# - Deploy the fixed functions
# - Show verification logs
```

---

## 🔑 API Keys Required (Choose One)

**Option 1: OpenAI** (Recommended - more reliable)
- Get key from: https://platform.openai.com/api-keys
- Model used: `gpt-4o-mini` (vision)
- Cost: ~$0.15 per 1000 images

**Option 2: Google Gemini** (Alternative)
- Get key from: https://aistudio.google.com/app/apikey
- Model used: `gemini-1.5-flash` (vision)
- Cost: ~$0.075 per 1000 images

**You need at least ONE of these keys for OCR to work!**

---

## 📋 What Was Fixed

### 1. Duplicate Imports ✅
- **File**: `supabase/functions/ocr-processor/index.ts`
- **Issue**: Triple import of `logStructuredEvent` (lines 2, 4, 6)
- **Fix**: Removed duplicates, kept line 2

### 2. Syntax Error ✅
- **File**: `supabase/functions/ocr-processor/index.ts`
- **Line**: 558
- **Issue**: `publishResult.error` without parameter name
- **Fix**: Added `error:` prefix

---

## 🚀 Deployment Options

### Option A: Automated (Recommended)
```bash
./fix-insurance-ocr.sh
```
Prompts for API keys, deploys everything, shows logs.

### Option B: Manual
```bash
# Set API key(s)
supabase secrets set OPENAI_API_KEY="sk-proj-..." --project-ref <ref>
# OR
supabase secrets set GEMINI_API_KEY="AIza..." --project-ref <ref>

# Deploy functions
supabase functions deploy ocr-processor --no-verify-jwt --project-ref <ref>
supabase functions deploy insurance-ocr --no-verify-jwt --project-ref <ref>

# Verify
supabase functions logs insurance-ocr --tail --project-ref <ref>
```

---

## 🧪 Testing After Deploy

### Test 1: WhatsApp Upload (Primary)
1. Send an insurance certificate image to your WhatsApp bot
2. Bot should respond with confirmation + extracted details
3. Check logs: `supabase functions logs insurance-ocr --tail`

**Success logs**:
```json
{"event": "INS_OCR_OPENAI_CALL", "model": "gpt-4o-mini"}
{"event": "INS_OCR_OK", "leadId": "...", "ms": 2500}
```

**Failure logs** (if API keys not set):
```json
{"event": "INS_INLINE_OCR_FAIL", "error": "no_ocr_provider", "status": 503}
```

### Test 2: Admin Panel
1. Go to Insurance Workbench
2. Select a pending document
3. Click "Queue OCR"
4. Should see extracted data

---

## ⚠️ Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| "no_ocr_provider" | No API keys set | Run script, enter API key when prompted |
| Circuit breaker open | 5+ consecutive failures | Wait 60s or redeploy function |
| OpenAI rate limit | Too many requests | Wait or use Gemini as fallback |
| Queue not processing | Cron job disabled | Check Supabase cron jobs |

---

## 📚 Documentation

- **INSURANCE_OCR_QUICK_REF.md** - Quick reference guide
- **INSURANCE_OCR_FIX_SUMMARY.md** - Complete documentation
- **OCR_PROCESSOR_KNOWN_ISSUE.md** - Issue history (now FIXED)

---

## 📊 Expected Behavior

### Before Fix
```
User uploads insurance image
    ↓
Parser error in ocr-processor (duplicate imports)
    ↓
Deployment fails
    ↓
OCR doesn't work
```

### After Fix (with API keys)
```
User uploads insurance image
    ↓
wa-webhook-insurance receives it
    ↓
Calls insurance-ocr with OpenAI/Gemini
    ↓
Extracts: owner name, vehicle plate, policy number, etc.
    ↓
Sends WhatsApp confirmation + notifies admins
    ↓
SUCCESS ✅
```

---

## 🎯 Next Steps

1. ✅ **Code fixes applied** - Done!
2. ⚠️ **Set API keys** - Run `./fix-insurance-ocr.sh`
3. 🚀 **Deploy** - Automated by script
4. 🧪 **Test** - Send image via WhatsApp
5. 📊 **Monitor** - Check logs for success

---

## 💡 Pro Tips

1. **OpenAI vs Gemini**: OpenAI is more reliable, Gemini is cheaper
2. **Both APIs**: Set both for automatic fallback
3. **Circuit Breaker**: After 5 failures, waits 60s before retrying
4. **Queue System**: Failed OCRs auto-retry via queue
5. **Manual Review**: Admin can always manually review if OCR fails

---

**Quick Deploy**: `./fix-insurance-ocr.sh`  
**Questions?**: Check INSURANCE_OCR_FIX_SUMMARY.md  
**Issues?**: See Troubleshooting section above

---

**Ready to fix OCR? Run the script now!** 🚀
