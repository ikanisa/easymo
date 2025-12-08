# Insurance OCR Fix - Quick Reference

## 🚀 Quick Deploy

```bash
# 1. Set environment
export SUPABASE_ACCESS_TOKEN="your-token-here"
export SUPABASE_PROJECT_REF="rweobwuwzswudbgjpdcc"  # Update if different

# 2. Run automated fix
./fix-insurance-ocr.sh

# Script will:
# - Check current secrets
# - Prompt for API keys (OPENAI_API_KEY and/or GEMINI_API_KEY)
# - Deploy fixed functions
# - Show verification logs
```

## ✅ What Was Fixed

1. **Duplicate imports** in `ocr-processor/index.ts` - Removed lines 4 and 6
2. **Syntax error** on line 558 - Added `error:` parameter name
3. **Documentation** - Updated OCR_PROCESSOR_KNOWN_ISSUE.md

## ⚠️ Critical: API Keys Required

OCR **will not work** without at least one of these:

```bash
# Option 1: OpenAI (recommended - more reliable)
supabase secrets set OPENAI_API_KEY="sk-proj-..." --project-ref <ref>

# Option 2: Gemini (alternative)
supabase secrets set GEMINI_API_KEY="AIza..." --project-ref <ref>
```

## 🧪 Testing

### Test 1: WhatsApp Upload
```
1. Send insurance certificate image to WhatsApp bot
2. Check logs: supabase functions logs insurance-ocr --tail
3. ✅ Success: See "INS_OCR_OK" event
4. ❌ Failure: See "no_ocr_provider" → API keys not set
```

### Test 2: Admin Panel
```
1. Navigate to Insurance Workbench
2. Click "Queue OCR" button
3. ✅ Success: Extracted data appears
```

## 📊 Expected Logs

### ✅ Success
```json
{"event": "INS_OCR_OPENAI_CALL", "model": "gpt-4o-mini"}
{"event": "INS_OCR_OK", "leadId": "...", "ms": 2500}
{"event": "INSURANCE_UPLOAD_OCR_OK"}
```

### ❌ Failure (Missing API Keys)
```json
{"event": "INS_INLINE_OCR_FAIL", "error": "no_ocr_provider", "status": 503}
{"event": "INS_FALLBACK_TO_QUEUE"}
```

## 🔄 Circuit Breaker

After 5 consecutive failures:
- Circuit **opens** (blocks all requests)
- Wait **60 seconds** for auto-reset
- Or redeploy to clear state

## 📝 Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ocr-processor/index.ts` | Fixed imports + syntax |
| `OCR_PROCESSOR_KNOWN_ISSUE.md` | Updated status to FIXED |
| `INSURANCE_OCR_FIX_SUMMARY.md` | Complete documentation |
| `fix-insurance-ocr.sh` | Automated deployment script |

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "no_ocr_provider" | Set OPENAI_API_KEY or GEMINI_API_KEY |
| Circuit breaker open | Wait 60s or redeploy function |
| OpenAI API error | Check credits, fallback to Gemini |
| Queue not processing | Check cron job, manually trigger |

## 📚 Documentation

- **INSURANCE_OCR_FIX_SUMMARY.md** - Complete guide
- **OCR_PROCESSOR_KNOWN_ISSUE.md** - Issue history
- **Issue #455** - GitHub issue tracker

## ⏭️ Next Steps

1. ✅ Code fixes applied
2. ⚠️ Set OCR provider API keys
3. 🚀 Deploy functions: `./fix-insurance-ocr.sh`
4. 🧪 Test via WhatsApp
5. 📊 Monitor logs

---

**Status**: Ready for deployment  
**Action Required**: Set API keys before deploying  
**Deploy**: `./fix-insurance-ocr.sh`
