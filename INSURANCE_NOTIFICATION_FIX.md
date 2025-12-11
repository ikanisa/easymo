# Insurance Admin Notification Fix

## Issue
Insurance request notifications were not being sent to all contacts in the `insurance_admin_contacts` table.

## Root Cause
The `fetchActiveContacts()` function in `ins_admin_notify.ts` was querying all active contacts without filtering by `category='insurance'`. Since the table supports multiple categories (admin_auth, insurance, support, general, escalation), it was potentially fetching wrong contacts or no contacts at all.

## Fix Applied

### 1. Updated Query Filter
**File**: `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts`

Added category filter and proper sorting:
```typescript
.eq("category", "insurance")
.order("priority", { ascending: true })
.order("display_order", { ascending: true })
```

### 2. Database Migration
**File**: `supabase/migrations/20251211005200_add_insurance_category_contacts.sql`

Ensures contacts have `category='insurance'`:
- Updates existing admin_auth contacts to insurance category if no insurance-specific contacts exist
- Adds table comment explaining category usage

### 3. Functions Deployed
- ✅ `wa-webhook-insurance` - Main insurance webhook
- ✅ `unified-ocr` - OCR processor that triggers notifications

## How It Works Now

1. When an insurance certificate is submitted, `notifyInsuranceAdmins()` is called
2. It fetches ALL contacts with `category='insurance'` and `is_active=true`
3. Uses `Promise.allSettled` to send to all contacts concurrently
4. Each send attempt is logged to `insurance_admin_notifications` table
5. Returns summary: `{ sent, failed, errors }`

## Testing

To verify the fix:
```bash
# Check insurance contacts exist
psql -c "SELECT id, display_name, destination, category FROM insurance_admin_contacts WHERE category='insurance' AND is_active=true;"

# Submit a test insurance certificate via WhatsApp
# Check logs for INSURANCE_ADMIN_NOTIFY_BROADCASTING event
```

## Related Files
- `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts`
- `supabase/functions/wa-webhook-insurance/insurance/ins_handler.ts`
- `supabase/functions/unified-ocr/domains/insurance.ts`
- `supabase/migrations/20251210143000_unify_admin_support_contacts.sql`
- `supabase/migrations/20251211005200_add_insurance_category_contacts.sql`

## Date
2025-12-11 00:52 UTC
