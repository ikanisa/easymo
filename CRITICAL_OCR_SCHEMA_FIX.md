# 🚨 CRITICAL FIX: Insurance OCR Schema Was Completely Wrong

**Date**: 2025-12-08 23:30 UTC  
**Severity**: CRITICAL - USER-FACING BUG  
**Status**: ✅ FIXED & DEPLOYED

## The Problem

Users were still seeing dashes (`—`) instead of extracted insurance data even after the "fix":

```
* Insurer: —
* Policy #: —
* Plate: —
* VIN/Chassis: —
```

## Root Cause

The OCR schema in `unified-ocr/schemas/insurance.ts` was using **COMPLETELY WRONG field names**:

### Wrong Schema (Before):
```typescript
{
  policy_no: { type: "string" },              // ❌
  insurer: { type: "string" },                // ❌
  effective_from: { type: "string" },         // ❌
  expires_on: { type: "string" },             // ❌
  coverage_amount: { type: ["number", "null"] }, // ❌
  beneficiary: { type: "string" },            // ❌
  policy_type: { type: "string" },            // ❌
}
```

### Correct Schema (After):
```typescript
{
  insurer_name: { type: "string" },           // ✅
  policy_number: { type: "string" },          // ✅
  certificate_number: { type: "string" },     // ✅
  policy_inception: { type: "string" },       // ✅
  policy_expiry: { type: "string" },          // ✅
  registration_plate: { type: ["string", "null"] }, // ✅
  vin_chassis: { type: ["string", "null"] },  // ✅
  make: { type: ["string", "null"] },         // ✅
  model: { type: ["string", "null"] },        // ✅
  vehicle_year: { type: ["integer", "null"] }, // ✅
}
```

## Why This Happened

There were **TWO different OCR schemas** in the codebase:

1. **`unified-ocr/schemas/insurance.ts`** - Wrong field names ❌
2. **`_shared/.../ins_ocr.ts`** - Correct field names ✅

The `unified-ocr` function was using schema #1 (wrong), while the normalization expected schema #2 (correct).

## The Flow (Broken)

```
1. User uploads insurance certificate
2. unified-ocr calls OpenAI with WRONG schema
3. OpenAI returns: { policy_no: "...", insurer: "...", effective_from: "..." }
4. Normalization looks for: { policy_number, insurer_name, policy_inception }
5. Fields don't match → all values are null
6. User sees: Insurer: —, Policy #: —, etc.
```

## The Fix

### 1. Corrected OCR Schema
**File**: `supabase/functions/unified-ocr/schemas/insurance.ts`

Changed all field names to match what the system expects:
- `policy_no` → `policy_number`
- `insurer` → `insurer_name`
- `effective_from` → `policy_inception`
- `expires_on` → `policy_expiry`
- Added missing fields: `certificate_number`, `registration_plate`, `vin_chassis`, `make`, `model`, `vehicle_year`

### 2. Added Fallback Mapping
**File**: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts`

Added fallback support for legacy field names:
```typescript
insurer_name: toNullableString(source.insurer_name) ?? toNullableString(source.insurer),
policy_number: toNullableString(source.policy_number) ?? toNullableString(source.policy_no),
policy_inception: normalizeDate(source.policy_inception) ?? normalizeDate(source.effective_from),
policy_expiry: normalizeDate(source.policy_expiry) ?? normalizeDate(source.expires_on),
```

## Deployment

```bash
# Committed fix
git commit -m "CRITICAL FIX: Correct OCR schema field names for insurance"

# Pushed to remote
git push origin main

# Deployed to production
supabase functions deploy unified-ocr --project-ref lhbowpbcpwoiparwnwgt
```

**Version**: unified-ocr v33 (deployed 2025-12-08 23:30 UTC)

## Expected Behavior NOW

Users should see actual extracted data:

```
Thanks! Here's what we captured:
* Insurer: SANLAM Rwanda
* Policy #: POL-2024-12345
* Certificate #: CERT-567890
* Plate: RAC123A
* VIN/Chassis: VF1ABC123456789
* Inception: 2024-01-15 • Expiry: 2025-01-14
* Make/Model/Year: Toyota/Corolla/2022
Our team will contact you shortly.
```

## Testing

### Manual Test
1. Send insurance certificate image via WhatsApp
2. Check that extracted data appears (not dashes)
3. Verify all fields are populated

### Database Verification
```sql
SELECT 
  id,
  raw_ocr->>'insurer_name' as insurer,
  raw_ocr->>'policy_number' as policy,
  extracted->>'insurer_name' as normalized_insurer,
  status
FROM insurance_leads
ORDER BY created_at DESC
LIMIT 1;
```

Should show:
- `raw_ocr` has `insurer_name`, `policy_number`, etc.
- `extracted` has properly normalized values
- `status = 'ocr_ok'`

## Why Previous "Fix" Didn't Work

The previous fix (commit `fc7c1c44`) only addressed the **normalization** side:
- Added fallback: `source.insurer ?? source.insurer_name`
- Fixed message typo: `$${...}` → `${...}`

But it didn't fix the **OCR schema** side, so OpenAI was still returning wrong field names!

## Files Changed

1. ✅ `supabase/functions/unified-ocr/schemas/insurance.ts` - Corrected schema
2. ✅ `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts` - Added fallbacks

## Commit

**Hash**: `3efb3270`  
**Message**: "CRITICAL FIX: Correct OCR schema field names for insurance"

---

**This should ACTUALLY fix the issue now!** 🎯
