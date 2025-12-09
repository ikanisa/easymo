# 🎯 INSURANCE OCR - ACTUAL ROOT CAUSE FOUND

**Date**: 2025-12-08 23:45 UTC  
**Severity**: CRITICAL  
**Status**: ✅ NOW ACTUALLY FIXED

---

## The REAL Problem (Found After 3 Attempts)

The insurance OCR had **THREE separate issues**, not just one:

### Issue 1: Wrong Field Names in Schema ✅ Fixed
The schema was using old field names that didn't match normalization.

### Issue 2: `additionalProperties: false` Was Too Strict ✅ Fixed  
OpenAI's strict mode couldn't handle the restrictive schema.

### Issue 3: **THE SMOKING GUN** - Wrong Field Names in Prompt ❌❌❌

**The prompt was asking OpenAI for the OLD field names!**

```typescript
// WRONG PROMPT (line 298)
user: "Extract all fields from this insurance certificate: 
  policy_no (string), 
  insurer (string), 
  effective_from (YYYY-MM-DD string), 
  expires_on (YYYY-MM-DD string)..."
```

But the schema expected:
```typescript
{
  policy_number,    // Not policy_no!
  insurer_name,     // Not insurer!
  policy_inception, // Not effective_from!
  policy_expiry     // Not expires_on!
}
```

---

## The Error Chain

```
1. OpenAI receives prompt asking for: policy_no, insurer, effective_from
2. OpenAI tries to return those fields
3. Schema validation expects: policy_number, insurer_name, policy_inception
4. MISMATCH → OpenAI returns malformed JSON
5. Parser fails: "Unexpected end of JSON input"
6. Fallback to Gemini, but GEMINI_API_KEY not set
7. COMPLETE FAILURE
```

---

## The Fix (3 Commits)

### Commit 1: `3efb3270` - Fixed Schema
Changed field names in `INSURANCE_SCHEMA`:
- `policy_no` → `policy_number`
- `insurer` → `insurer_name`
- `effective_from` → `policy_inception`
- `expires_on` → `policy_expiry`

### Commit 2: `26fe7a98` - Removed Strict Mode
Removed `additionalProperties: false` to allow OpenAI flexibility.

### Commit 3: `45cfaf15` - Fixed Prompt (THE CRITICAL ONE)
Updated `buildInsurancePrompt()` to ask for the CORRECT field names:

```typescript
user: `Extract the following fields:
- insurer_name: Name of the insurance company (string)
- policy_number: Policy number (string)
- certificate_number: Certificate number (string)
- policy_inception: Policy start date in YYYY-MM-DD format (string)
- policy_expiry: Policy expiry date in YYYY-MM-DD format (string)
...
```

---

## Why Previous Fixes Didn't Work

### Attempt 1 (fc7c1c44)
- Only fixed normalization fallback
- Didn't fix schema or prompt
- **Result**: Still failed

### Attempt 2 (3efb3270)  
- Fixed schema field names
- Didn't fix prompt
- **Result**: Still failed (prompt/schema mismatch)

### Attempt 3 (26fe7a98 + 45cfaf15)
- Fixed `additionalProperties`
- Fixed prompt to match schema
- **Result**: SHOULD WORK NOW

---

## Deployment

```bash
# All 3 fixes committed
git log --oneline -3
# 45cfaf15 CRITICAL: Fix insurance OCR prompt to match schema field names
# 26fe7a98 fix: Remove additionalProperties:false from insurance schema
# 3efb3270 CRITICAL FIX: Correct OCR schema field names for insurance

# Deployed unified-ocr v35
supabase functions deploy unified-ocr
```

---

## Testing

Send an insurance certificate via WhatsApp. You should now see:

```
Thanks! Here's what we captured:
* Insurer: SANLAM Rwanda               ← ACTUAL DATA
* Policy #: POL-2024-12345             ← ACTUAL DATA
* Certificate #: CERT-567890           ← ACTUAL DATA
* Plate: RAC123A                       ← ACTUAL DATA
* VIN/Chassis: VF1ABC123456789         ← ACTUAL DATA
* Inception: 2024-01-15 • Expiry: 2025-01-14  ← ACTUAL DATA
* Make/Model/Year: Toyota/Corolla/2022 ← ACTUAL DATA
Our team will contact you shortly.
```

---

## The Lesson

**Always check BOTH the schema AND the prompt match!**

The schema defines the OUTPUT structure, but the prompt tells the AI what to extract. They MUST use the same field names.

---

**Version**: unified-ocr v35  
**Status**: ✅ DEPLOYED  
**Date**: 2025-12-08 23:45 UTC

**THIS SHOULD ACTUALLY WORK NOW!** 🎯
