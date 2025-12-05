# Vehicle OCR Field Mapping Fix - Deployed

**Date**: 2025-12-05  
**Status**: ✅ **DEPLOYED**  
**Service**: `wa-webhook-profile`

## Problem

Users uploading insurance certificates for vehicle registration were getting:
```
⚠️ Could not find vehicle plate number.
```

Even though the OCR successfully extracted the plate number from the document.

### Logs showing the issue:
```json
{"event":"INS_UPLOAD_OK","leadId":"986632b7-5ba4-474a-88d8-6fed060390e9"}
{"event":"INS_MEDIA_FETCH_OK","mediaId":"695908960033541"}
// But then: error message about missing plate
```

## Root Cause

**Field name mismatch** between OCR output and vehicle handler:

1. **OCR normalization** (`ins_normalize.ts`) returns: `registration_plate`
2. **Vehicle handler** (`vehicles/add.ts`) was looking for: `vehicle_plate` OR `plate_number`  
3. The two never matched! ❌

```typescript
// OCR returns this:
const extracted = {
  registration_plate: "RAB123C",  // ← Actual field name
  insurer_name: "SANLAM",
  policy_expiry: "2025-12-31",
  // ...
}

// Handler was checking:
const plateNumber = extracted?.vehicle_plate || extracted?.plate_number;  
// ❌ Always null!
```

## Solution

### 1. Updated Field Lookup
```typescript
// supabase/functions/wa-webhook-profile/vehicles/add.ts (line 173)
const plateNumber = extracted?.registration_plate ||  // ← ADDED (primary)
                    extracted?.vehicle_plate || 
                    extracted?.plate_number;
```

### 2. Added Debug Logging
```typescript
logStructuredEvent("VEHICLE_OCR_RESULT", {
  userId: ctx.profileId,
  leadId,
  hasNormalized: !!ocrResult.normalized,
  hasRaw: !!ocrResult.raw,
  extractedKeys: extracted ? Object.keys(extracted) : [],
  extracted: extracted || {},
}, "info");
```

Now we can see exactly what the OCR returns for future debugging.

### 3. Enhanced Error Logging
```typescript
logStructuredEvent("VEHICLE_PLATE_NOT_FOUND", {
  userId: ctx.profileId,
  leadId,
  extractedFields: extracted ? Object.keys(extracted) : [],
}, "warn");
```

## Testing

### Expected Flow
1. User uploads insurance certificate image
2. OCR extracts: `registration_plate`, `insurer_name`, `policy_expiry`, etc.
3. Handler checks `registration_plate` **first** (now matches!)
4. Vehicle created successfully ✅

### Expected Logs
```json
{"event":"INS_UPLOAD_OK","leadId":"...","path":"..."}
{"event":"VEHICLE_OCR_RESULT","extractedKeys":["registration_plate","insurer_name",...]}
{"event":"VEHICLE_ADDED_SUCCESS","vehicleId":"...","plate":"RAB123C"}
```

## Why This Happened

The `ins_normalize.ts` file uses the **standard insurance industry field names**:
- `registration_plate` (standard terminology)
- `vin_chassis` (standard)
- `policy_expiry` (standard)

But the vehicle handler was written expecting **database column names**:
- `vehicle_plate` (our DB column)
- `plate_number` (alternative name)

**Solution**: Check the **normalized field first**, then fall back to alternatives.

## Files Changed

- ✅ `supabase/functions/wa-webhook-profile/vehicles/add.ts`
  - Line 173: Add `registration_plate` as primary field
  - Line 159-170: Add OCR result logging
  - Line 180-184: Add plate not found logging

## Deployment

```bash
supabase functions deploy wa-webhook-profile --no-verify-jwt
```

**Status**: ✅ Live in production

## Related Documentation

- Insurance OCR normalization: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts`
- Insurance extraction types: Lines 1-16 (defines `InsuranceExtraction` type)
- Vehicle addition flow: `VEHICLE_MANAGEMENT_COMPLETE.md`

## Next Steps

Test with a real insurance certificate upload to confirm the fix works end-to-end.

---
**Commit**: `fix(vehicles): map registration_plate OCR field correctly`
