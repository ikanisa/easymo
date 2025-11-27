# OCR Jobs Fix - Quick Reference

## Problem
```
vendor.menu.store_fail { code: "PGRST205", details: null, 
hint: "Perhaps you meant the table 'public.SoraJobQueue'", 
message: "Could not find the table 'public.ocr_jobs' in the schema cache" }
```

## Quick Fix
```bash
# Deploy
./deploy-ocr-jobs-fix.sh

# Verify
./verify-ocr-jobs-fix.sh
```

## What Was Created
1. **ocr_jobs table** - Tracks OCR processing jobs for menu uploads
2. **menu_upload_requests table** - Manages menu upload workflow and approvals

## Testing
Send an image to a vendor's WhatsApp number. The system should now:
1. ✅ Accept the image upload
2. ✅ Store file in MENU_MEDIA_BUCKET
3. ✅ Create entry in ocr_jobs table
4. ✅ Trigger OCR processing
5. ✅ No more "table not found" errors

## Files
- `supabase/migrations/20251123193200_create_ocr_jobs_table.sql`
- `supabase/migrations/20251123193300_create_menu_upload_requests_table.sql`
- `deploy-ocr-jobs-fix.sh`
- `verify-ocr-jobs-fix.sh`
- `OCR_JOBS_TABLE_FIX.md` (detailed docs)

## Related Code
- `supabase/functions/wa-webhook/flows/vendor/menu.ts:81` (uses ocr_jobs)
- `supabase/functions/wa-webhook/flows/vendor/menu.ts:145` (uses menu_upload_requests)
