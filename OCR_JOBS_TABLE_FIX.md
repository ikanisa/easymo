# OCR Jobs Table Fix - Summary

## Issue
WhatsApp webhook logs show an error when processing vendor menu uploads:
```
"Could not find the table 'public.ocr_jobs' in the schema cache"
```

The error occurs in `supabase/functions/wa-webhook/flows/vendor/menu.ts` at line 81 when trying to insert into the `ocr_jobs` table.

## Root Cause
The `ocr_jobs` and `menu_upload_requests` tables are referenced in the webhook code but don't exist in the current database schema. These tables were present in older migrations (backup_20251114_104454) but not in the active migration set.

## Solution
Created two new migrations to add the missing tables:

### 1. Migration: 20251123193200_create_ocr_jobs_table.sql
- Creates `public.ocr_jobs` table for tracking OCR processing jobs
- Adds enum type `ocr_job_status` with values: queued, processing, succeeded, failed
- Includes indexes for performance (status, bar_id, menu_id)
- Adds RLS policies for platform and vendor access
- Sets up updated_at trigger

### 2. Migration: 20251123193300_create_menu_upload_requests_table.sql
- Creates `public.menu_upload_requests` table for menu upload workflow
- Tracks upload status, file details, and approval workflow
- Includes indexes on bar_id + status, and status + created_at
- Adds RLS policies for platform and bar manager access

## Deployment

### Option 1: Using Deployment Script (Easiest)
```bash
cd /Users/jeanbosco/workspace/easymo-
./deploy-ocr-jobs-fix.sh
```

### Option 2: Supabase CLI
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push
```

### Option 3: Manual SQL Execution
If Supabase CLI is unavailable, execute the migrations in the Supabase SQL Editor in order:
1. `supabase/migrations/20251123193200_create_ocr_jobs_table.sql`
2. `supabase/migrations/20251123193300_create_menu_upload_requests_table.sql`

### Verification
After deployment, run the verification script:
```bash
./verify-ocr-jobs-fix.sh
```

## Verification
After deployment, the webhook error should be resolved. The vendor menu upload feature will be able to:
1. Store uploaded menu files in the MENU_MEDIA_BUCKET
2. Queue OCR jobs in the `ocr_jobs` table
3. Track menu upload requests in the `menu_upload_requests` table

## Files Modified
- Created: `supabase/migrations/20251123193200_create_ocr_jobs_table.sql`
- Created: `supabase/migrations/20251123193300_create_menu_upload_requests_table.sql`
- Created: `deploy-ocr-jobs-fix.sh` (deployment script)
- Created: `verify-ocr-jobs-fix.sh` (verification script)
- Created: `OCR_JOBS_TABLE_FIX.md` (this summary)

## Related Code
- `supabase/functions/wa-webhook/flows/vendor/menu.ts` (lines 80-87, 145-154)
- Uses tables for vendor menu upload and restaurant menu upload workflows

## Impact
- Fixes vendor menu upload feature for WhatsApp users
- Enables OCR processing workflow for menu items
- Supports restaurant menu upload and approval workflow
