# Insurance OCR - Quick Reference

**Status:** ✅ FIXED AND DEPLOYED  
**Date:** 2025-12-08  
**Version:** unified-ocr v5

---

## 🚨 Problem (RESOLVED)

```
Error: "Edge Function returned a non-2xx status code"
Cause: Invalid OpenAI model "gpt-5" (doesn't exist)
```

## ✅ Solution Applied

```typescript
// Fixed: supabase/functions/unified-ocr/core/openai.ts
const OPENAI_MODEL = "gpt-4o"  // Was: "gpt-5" ❌
```

---

## 📡 Current Architecture

```
WhatsApp User → wa-webhook-insurance → unified-ocr (gpt-4o) → Response
                                              ↓
                                         (fallback)
                                              ↓
                                         Gemini API
```

**Active Functions:** Only `unified-ocr` (v5)  
**Deleted:** insurance-ocr, ocr-processor, vehicle-ocr

---

## 🧪 Testing

### Via WhatsApp
1. Send insurance certificate image to bot
2. Click "Submit certificate"
3. ✅ Should receive confirmation and summary

### Via Script
```bash
./test-insurance-ocr.sh https://example.com/cert.jpg
```

---

## 📊 Expected Logs

### ✅ Success Flow
```
UNIFIED_OCR_INLINE_START
INS_OCR_INLINE_SUCCESS
INS_LEAD_UPDATE_OK
INS_ADMIN_NOTIFY_OK
```

### ❌ Old Errors (RESOLVED)
```
INS_INLINE_INVOKE_FAIL          ← Fixed
Edge Function returned non-2xx   ← Fixed
```

---

## 🚀 Quick Commands

```bash
# Deploy
supabase functions deploy unified-ocr --project-ref lhbowpbcpwoiparwnwgt

# Test
./test-insurance-ocr.sh <image-url>

# Check status
supabase functions list | grep ocr
```

---

**See INSURANCE_OCR_FIX_COMPLETE.md for full details**

**Last Updated:** 2025-12-08  
**Status:** Production ✅  
**Model:** gpt-4o (corrected from gpt-5)
