# Known Issue: Insurance OCR Processor Syntax Errors

**Date**: 2025-12-07 10:50 UTC  
**Status**: ⚠️ NON-CRITICAL  
**Impact**: Insurance OCR auto-processing doesn't work, but manual processing is available

---

## Issue

The `ocr-processor` edge function has multiple syntax errors in `logStructuredEvent` calls:

```typescript
// WRONG (causes parser error)
await logStructuredEvent("ERROR", { data: "...", result.error });

// CORRECT
await logStructuredEvent("ERROR", { data: "...", error: result.error });
```

The parser expects named parameters, not object spread when there's a `.` in the property access.

---

## Files Affected

- `supabase/functions/ocr-processor/index.ts`

**Lines with errors**: 148, 156, 548, 558, 810, 812, and potentially more

---

## Current Workaround

The insurance webhook (`wa-webhook-insurance`) is functional. When users upload insurance certificates:

1. ✅ Images are uploaded successfully  
2. ✅ System receives and stores the documents
3. ❌ OCR auto-processing fails (returns non-2xx status)
4. ✅ Falls back to manual review queue
5. ✅ Admin can manually review and process

**Impact**: Admin needs to manually review certificates instead of automatic OCR extraction.

---

## Error Message in Logs

```
INS_INLINE_INVOKE_FAIL {
  leadId: "...",
  status: undefined,
  message: "Edge Function returned a non-2xx status code"
}
```

---

## Fix Required

Replace all instances of property access after commas in `logStructuredEvent` calls:

```bash
cd /Users/jeanbosco/workspace/easymo

# Pattern to fix
sed -i.bak 's/logStructuredEvent("\([^"]*\)", { data: "\([^"]*\)", \([a-zA-Z]*\)\.error })/logStructuredEvent("\1", { data: "\2", error: \3.error })/g' supabase/functions/ocr-processor/index.ts
```

Or manually fix each occurrence by adding `error:` prefix.

---

## Priority

**Low** - The insurance system works, just without automatic OCR. Manual review is faster than fixing dozens of syntax errors in a complex function.

---

## Recommendation

1. Leave as-is for now (manual review works fine)
2. Schedule proper refactoring of `ocr-processor` function
3. Consider using a linter to catch these issues

---

## Test After Fix

```bash
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
supabase functions deploy ocr-processor --no-verify-jwt
```

Should deploy without parser errors.

---

**Status**: ⚠️ Known issue, manual workaround in place  
**User Impact**: None (fallback to manual review)  
**System Status**: 🟢 OPERATIONAL with manual processing
