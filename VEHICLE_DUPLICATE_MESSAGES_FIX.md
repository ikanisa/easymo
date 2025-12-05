# Vehicle Insurance Upload Duplicate Messages Fix

## Issue
Users receive multiple duplicate messages when uploading vehicle insurance documents:
- 3-4x "⏳ Processing your insurance certificate..."
- 3-4x "✅ Vehicle Added Successfully!"
- Multiple database records created for same upload

**Example from logs:**
```
[02:44] "⏳ Processing..." 
[02:44] "⏳ Processing..." 
[02:44] "⏳ Processing..." 
[02:44] "✅ Vehicle Added Successfully!"
[02:44] "✅ Vehicle Added Successfully!"
[02:44] "✅ Vehicle Added Successfully!"
```

## Root Cause
WhatsApp Cloud API delivers webhooks **multiple times** for the same message (known WhatsApp behavior). The vehicle insurance upload handler had **no deduplication** mechanism.

**What happened:**
1. User uploads ONE insurance photo (mediaId: `1545509359930067`)
2. WhatsApp webhook fires 4 times for same message
3. Each webhook creates new `insurance_lead` record:
   - `6056188c-796d-4424-8145-e7198a5d0f9b`
   - `fa5c600c-de3a-404a-b7ac-e09cba1e9d66`
   - `3d6214e2-7476-4b44-b3eb-5f88eff6e3e6`
4. Each processes OCR independently
5. Each sends messages independently
6. User gets 3-4x messages

## Solution
Added **idempotency check** at the start of `handleVehicleInsuranceUpload()`:

```typescript
// Check if this media has already been processed (deduplication)
const { data: existingMedia } = await ctx.supabase
  .from("insurance_media")
  .select("lead_id, insurance_leads!inner(status)")
  .eq("wa_media_id", mediaId)
  .eq("insurance_leads.user_id", ctx.profileId)
  .single();

if (existingMedia) {
  // Already processed - skip silently (WhatsApp duplicate webhook)
  logStructuredEvent("VEHICLE_DUPLICATE_MEDIA", {
    userId: ctx.profileId,
    mediaId,
    existingLeadId: existingMedia.lead_id,
  }, "info");
  return true; // Exit early, no message sent
}

// Only show processing message if not duplicate
await sendText(ctx.from, "⏳ Processing your insurance certificate...");
```

## How It Works
1. First webhook arrives with mediaId
2. Handler checks if `insurance_media` table has this mediaId for this user
3. If **NOT found** → Process normally (create lead, OCR, send messages)
4. If **FOUND** → Skip silently (log "VEHICLE_DUPLICATE_MEDIA", return true)
5. Subsequent duplicate webhooks exit early without processing

## Files Changed
`supabase/functions/wa-webhook-profile/vehicles/add.ts`
- Added deduplication check before processing
- Moved "Processing..." message after dedup check
- Added structured log event for duplicate detection

## Benefits
✅ **Single message** per upload (no duplicates)
✅ **Single database record** per upload
✅ **Idempotent** - safe to call multiple times
✅ **Efficient** - early exit on duplicates (no OCR waste)
✅ **Logged** - can track duplicate webhook frequency

## Testing
1. Upload insurance photo
2. Verify only ONE "Processing..." message
3. Verify only ONE "Success" message
4. Check logs for any "VEHICLE_DUPLICATE_MEDIA" events
5. Confirm only one record in `insurance_media` table

## Deployment
```bash
supabase functions deploy wa-webhook-profile --no-verify-jwt
```

**Status**: ✅ Deployed (2025-12-05)

## Related
This is a **standard WhatsApp webhook pattern** - duplicate delivery happens with:
- Poor network conditions
- WhatsApp retries
- Load balancer issues
- Webhook timeouts

**Recommendation**: Apply similar idempotency checks to ALL webhook handlers that process user uploads or create records.
