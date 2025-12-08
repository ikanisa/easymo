# Insurance OCR Data Not Showing - Root Cause & Fix

**Issue**: Users see `—` (dashes) instead of extracted insurance data  
**Example Message**:
```
Thanks! Here's what we captured:
* Insurer: —
* Policy #: —
* Certificate #: —
* Plate: —
* VIN/Chassis: —
* Inception: — • Expiry: $—
* Make/Model/Year: —/—/—
```

## Root Cause Analysis

The issue is likely in ONE of these areas:

### 1. OCR Extraction Failing
**Location**: `supabase/functions/unified-ocr/domains/insurance.ts`
- `runInsuranceOCR()` might be returning empty/null values
- OpenAI/Gemini API might not be extracting fields properly

### 2. Normalization Logic Issue
**Location**: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts`
- `normalizeInsuranceExtraction()` might not be mapping raw OCR → normalized fields
- Field names might not match between OCR schema and normalization

### 3. Message Building (Minor Issue Found)
**Location**: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_messages.ts`
- Line 21 has typo: `$${safe(...)}` should be `${safe(...)}`
- This causes `Expiry: $—` instead of `Expiry: —`

## Investigation Steps

### Step 1: Check Raw OCR Output
```sql
SELECT 
  id,
  raw_ocr,
  extracted,
  status,
  created_at
FROM insurance_leads
ORDER BY created_at DESC
LIMIT 5;
```

Look for:
- Is `raw_ocr` populated with data from OpenAI/Gemini?
- Is `extracted` populated with normalized fields?
- Does `status = 'ocr_ok'`?

### Step 2: Check OCR Function Logs
```bash
# Check unified-ocr logs for errors
supabase functions logs unified-ocr --project-ref lhbowpbcpwoiparwnwgt --tail

# Look for:
# - "INS_OCR_INLINE_START"
# - "INS_OCR_INLINE_SUCCESS" or "INS_OCR_INLINE_ERROR"
```

### Step 3: Verify Schema Match
The OCR schema expects these fields (from `schemas/insurance.ts`):
- `insurer`
- `policy_number`  
- `certificate_number`
- `registration_plate`
- `vin_chassis`
- `policy_inception`
- `policy_expiry`
- `make`, `model`, `vehicle_year`

The normalized extraction expects:
- `insurer_name` (mapped from `insurer`)
- `policy_number`
- `certificate_number`
- `registration_plate`
- `vin_chassis`
- `policy_inception`
- `policy_expiry`
- `make`, `model`, `vehicle_year`

**Potential mismatch**: `insurer` → `insurer_name`

## Fixes Required

### Fix 1: Remove Typo in Message (Minor)
**File**: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_messages.ts`

```typescript
// BEFORE (line 20-21)
`• Inception: ${safe(extracted.policy_inception)} • Expiry: ` +
  `$${safe(extracted.policy_expiry)}`,

// AFTER
`• Inception: ${safe(extracted.policy_inception)} • Expiry: ${safe(extracted.policy_expiry)}`,
```

### Fix 2: Verify Normalization Logic
**File**: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts`

Need to verify the function properly maps:
```typescript
export function normalizeInsuranceExtraction(raw: any): InsuranceExtraction {
  return {
    insurer_name: raw?.insurer ?? raw?.insurer_name ?? null,
    policy_number: raw?.policy_number ?? null,
    certificate_number: raw?.certificate_number ?? null,
    // ... etc
  };
}
```

### Fix 3: Add Logging for Debugging
Add logs to see what OCR is actually extracting:

```typescript
// In processInsuranceInline()
const raw = await runInsuranceOCR(payload.signedUrl, payload.mime);
console.log("OCR_RAW_OUTPUT", JSON.stringify(raw, null, 2));

const normalized = normalizeInsuranceExtraction(raw);
console.log("OCR_NORMALIZED", JSON.stringify(normalized, null, 2));
```

## Quick Test

```bash
# Send test image via WhatsApp
# Then immediately check logs:
supabase functions logs unified-ocr --tail | grep "OCR_RAW\\|OCR_NORMALIZED"
```

## Next Steps

1. Check database to see if `raw_ocr` and `extracted` are populated
2. If NO: OCR extraction is failing → check API keys and logs
3. If YES but empty: Normalization issue → fix mapping
4. If YES with data: Message building issue → deploy fixes

---

**Status**: INVESTIGATING  
**Priority**: HIGH - User-facing data display issue
