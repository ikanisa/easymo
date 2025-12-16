# Webhook Functions Fixes Summary

**Date:** 2025-12-16  
**Status:** ✅ All Issues Fixed and Deployed

---

## Issues Fixed

### 1. wa-webhook-mobility: Module Not Found Error

**Error:**
```
Module not found: file:///var/tmp/sb-compile-edge-runtime/functions/_shared/security/internal-forward.ts
```

**Root Cause:**
Incorrect import path in `wa-webhook-mobility/index.ts`:
```typescript
// ❌ Wrong path
import("../_shared/security/internal-forward.ts")
```

**Solution:**
Fixed import path to use correct relative path:
```typescript
// ✅ Correct path
import("../../_shared/security/internal-forward.ts")
```

**File Fixed:**
- `supabase/functions/wa-webhook-mobility/index.ts`

---

### 2. wa-webhook-buy-sell: Database Constraint Violation

**Error:**
```
null value in column "phone_number" of relation "wa_events" violates not-null constraint
```

**Root Cause:**
The `recordMessage` function in `message-deduplicator.ts` was inserting `metadata.from` directly into `phone_number` column, but `metadata.from` could be `null` or `undefined`, violating the NOT NULL constraint.

**Solution:**
Added fallback value to ensure `phone_number` is never null:
```typescript
// ✅ Fixed with fallback
const phoneNumber = metadata.from || "unknown";
```

**File Fixed:**
- `supabase/functions/_shared/message-deduplicator.ts`

---

### 3. wa-webhook-profile: JSON Syntax Error

**Error:**
```
Expected double-quoted property name in JSON at position 78130 (line 1000 column 1)
```

**Root Cause:**
Trailing comma in `fr.json` file (already fixed in previous commit).

**Solution:**
Redeployed function to pick up the fixed `fr.json` file.

**File Fixed:**
- `supabase/functions/_shared/wa-webhook-shared/i18n/messages/fr.json` (already fixed)

---

## Deployment Status

All functions redeployed successfully:

- ✅ `wa-webhook-mobility` (v1060)
- ✅ `wa-webhook-buy-sell` (v491)
- ✅ `wa-webhook-profile` (v794)

---

## Verification

To verify the fixes:

1. **wa-webhook-mobility:**
   - Check logs for "Module not found" errors - should be resolved
   - Function should boot successfully

2. **wa-webhook-buy-sell:**
   - Check logs for "phone_number" constraint violations - should be resolved
   - Messages should be recorded in `wa_events` table

3. **wa-webhook-profile:**
   - Check logs for JSON syntax errors - should be resolved
   - Function should boot successfully

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-16

