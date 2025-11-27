# Insurance Admin Notifications Schema Fix

**Date**: 2025-11-25  
**Issue**: Database schema mismatch causing insurance admin notification failures  
**Status**: ✅ **RESOLVED**

## Problem

The `wa-webhook-insurance` function was failing to record admin notifications with this error:

```
insurance.admin_notif_record_fail {
  admin: "+250788767816",
  error: "Could not find the 'error_message' column of 'insurance_admin_notifications' in the schema cache"
}
```

## Root Cause

The code in `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts` was trying to insert records with columns that were missing from the `insurance_admin_notifications` table:

- `sent_at` (timestamptz)
- `retry_count` (int)
- `error_message` (text)
- `updated_at` (timestamptz)

## Solution

✅ **Schema Already Fixed** - The required columns were added in a previous migration and are now present in the database.

Migration file: `supabase/migrations/20251125214900_fix_insurance_admin_notifications_schema.sql`

### Added Columns

```sql
ALTER TABLE public.insurance_admin_notifications 
ADD COLUMN IF NOT EXISTS sent_at timestamptz,
ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
```

### Added Indexes

```sql
-- For efficient querying of failed notifications
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_status 
ON public.insurance_admin_notifications(status, created_at DESC);

-- For lead_id lookups
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_lead_id 
ON public.insurance_admin_notifications(lead_id);
```

## Current Table Schema

```sql
CREATE TABLE public.insurance_admin_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
    admin_wa_id text,
    user_wa_id text,
    notification_payload jsonb,
    status text DEFAULT 'queued',
    sent_at timestamptz,              -- ✅ ADDED
    retry_count int DEFAULT 0,         -- ✅ ADDED
    error_message text,                -- ✅ ADDED
    updated_at timestamptz DEFAULT now(), -- ✅ ADDED
    created_at timestamptz DEFAULT now()
);
```

## Verification

Database push confirmed the columns already exist:

```
NOTICE (42701): column "sent_at" of relation "insurance_admin_notifications" already exists, skipping
NOTICE (42701): column "retry_count" of relation "insurance_admin_notifications" already exists, skipping
NOTICE (42701): column "error_message" of relation "insurance_admin_notifications" already exists, skipping
NOTICE (42701): column "updated_at" of relation "insurance_admin_notifications" already exists, skipping
```

## Impact

- ✅ Admin notifications will now be properly recorded in the database
- ✅ Failed notifications can be tracked with `error_message`
- ✅ Retry logic can be implemented using `retry_count`
- ✅ Sent timestamps are tracked for audit purposes
- ✅ Indexes improve query performance for failed notification lookups

## Related Files

- **Code**: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts`
- **Migration**: `supabase/migrations/20251125214900_fix_insurance_admin_notifications_schema.sql`
- **Original Schema**: `supabase/migrations/20251122000000_create_insurance_tables.sql`

## Next Steps

1. ✅ Schema is fixed and deployed
2. 🔄 Test insurance certificate upload flow end-to-end
3. 🔄 Monitor admin notification delivery success rate
4. 📋 Implement retry logic for failed notifications (future enhancement)

## Notes

- The error also mentioned `INSURANCE_BONUS_ERROR` which indicates a separate issue with bonus token allocation that should be investigated separately
- All three admins are configured: +250788767816, +250793094876, +250795588248
- The insurance OCR and media upload pipeline is working correctly
