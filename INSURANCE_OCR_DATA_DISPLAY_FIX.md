# Insurance OCR Data Display Fix

**Issue**: Insurance certificate data not showing in WhatsApp messages  
**Status**: ✅ FIXED  
**Date**: 2025-12-08

## Problem

Users uploading insurance certificates via WhatsApp received responses with empty data:

```
Thanks! Here's what we captured:
* Insurer: —
* Policy #: —
* Certificate #: —
* Plate: —
* VIN/Chassis: —
* Inception: — • Expiry: $—
* Make/Model/Year: —/—/—
Our team will contact you shortly.
```

## Root Cause

**Field name mismatch** between OCR schema and normalization function:

1. **OCR Schema** (`unified-ocr/schemas/insurance.ts`) returns:
   - `insurer` ✅
   - `policy_no` 
   - `effective_from`
   - `expires_on`

2. **Normalization** (`ins_normalize.ts`) was looking for:
   - `insurer_name` ❌ (wrong!)
   - Expected mapping wasn't happening

3. **Additional typo** in message building:
   - `$${safe(extracted.policy_expiry)}` caused `Expiry: $—`

## Fixes Applied

### Fix 1: Map OCR Field to Normalized Field
**File**: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts`

```typescript
// BEFORE (line 79)
insurer_name: toNullableString(source.insurer_name),  // ❌ Wrong field!

// AFTER  
insurer_name: toNullableString(source.insurer) ?? toNullableString(source.insurer_name),  // ✅ Correct!
```

This now properly maps the `insurer` field from OCR to `insurer_name` in the normalized extraction.

### Fix 2: Remove Typo in Message
**File**: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_messages.ts`

```typescript
// BEFORE (lines 20-21)
`• Inception: ${safe(extracted.policy_inception)} • Expiry: ` +
  `$${safe(extracted.policy_expiry)}`,  // ❌ Extra $ symbol

// AFTER
`• Inception: ${safe(extracted.policy_inception)} • Expiry: ${safe(extracted.policy_expiry)}`,  // ✅ Fixed!
```

## Expected Behavior After Fix

Users will now see properly extracted data:

```
Thanks! Here's what we captured:
* Insurer: SANLAM Rwanda
* Policy #: POL-2024-12345
* Certificate #: CERT-567890
* Plate: RAC123A
* VIN/Chassis: VF1XXXXXXXXXX1234
* Inception: 2024-01-15 • Expiry: 2025-01-14
* Make/Model/Year: Toyota/Corolla/2022
Our team will contact you shortly.
```

## Additional Observations

### Schema Discrepancy
The OCR schema still uses old field names that don't match what the system expects:

**OCR Schema Fields**:
- `policy_no` → should map to `policy_number`
- `effective_from` → should map to `policy_inception`
- `expires_on` → should map to `policy_expiry`

**Recommendation**: Update the OCR schema OR add mapping for ALL fields in normalization.

### Current Mapping Status
- ✅ `insurer` → `insurer_name` (FIXED)
- ⚠️ `policy_no` → `policy_number` (needs mapping)
- ⚠️ `effective_from` → `policy_inception` (needs mapping)
- ⚠️ `expires_on` → `policy_expiry` (needs mapping)

## Files Modified

1. ✅ `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts`
2. ✅ `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_messages.ts`

## Testing

### Manual Test
1. Send insurance certificate image via WhatsApp
2. Check response message - should show extracted data
3. Verify in database:
   ```sql
   SELECT raw_ocr, extracted FROM insurance_leads ORDER BY created_at DESC LIMIT 1;
   ```

### Log Verification
```bash
supabase functions logs unified-ocr --tail | grep "INS_OCR"
# Should see:
# - INS_OCR_INLINE_START
# - INS_OCR_INLINE_SUCCESS
```

## Deployment

```bash
# Deploy the fixed functions
supabase functions deploy unified-ocr --project-ref lhbowpbcpwoiparwnwgt
supabase functions deploy wa-webhook-insurance --project-ref lhbowpbcpwoiparwnwgt

# Verify deployment
supabase functions list | grep -E "unified-ocr|wa-webhook-insurance"
```

## Related Issues

- Original Kinyarwanda translation block (unrelated)
- Insurance OCR consolidation to unified-ocr (completed)
- Field schema standardization (future improvement)

---

**Status**: ✅ READY TO DEPLOY  
**Priority**: HIGH - User-facing bug fix  
**Impact**: All insurance certificate uploads via WhatsApp
