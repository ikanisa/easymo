# Log Monitoring Issues - Critical Database Schema Mismatch

## Date: 2025-01-20

## Critical Issues Identified

### 1. Database Schema Mismatch (CRITICAL)
**Problem**: Code is querying columns that don't exist in the `profiles` table.

**Actual `profiles` table columns:**
- `id`, `user_id`, `phone_number`, `wa_id`, `full_name`, `language`, `created_at`, `updated_at`, `mobility_role`

**Code is trying to query (DO NOT EXIST):**
- `whatsapp_number` ❌
- `phone_e164` ❌
- `whatsapp_e164` ❌

**Correct columns to use:**
- `wa_id` ✅ (WhatsApp ID)
- `phone_number` ✅ (Phone number)

### 2. Error Patterns in Logs

#### PostgreSQL Errors:
```
ERROR: column profiles.whatsapp_number does not exist
ERROR: column profiles.phone_e164 does not exist
ERROR: column profiles.whatsapp_e164 does not exist
ERROR: Error in ensure_whatsapp_user: column reference "user_id" is ambiguous - 42702
```

#### Edge Function Errors:
- Persistent 500 errors in `wa-webhook-core` and `wa-webhook-profile`
- These are likely caused by the database query failures above

### 3. Files That Need Fixing

Based on grep results, the following files reference non-existent columns:

1. **`supabase/functions/_shared/wa-webhook-shared/state/store.ts`**
   - References: `whatsapp_e164`, `whatsapp_number`, `phone_e164`

2. **`supabase/functions/wa-webhook-profile/handlers/wallet.ts`**
   - References: `whatsapp_e164`

3. **`supabase/functions/notify-buyers/handlers/interactive-buttons.ts`**
   - References: `whatsapp_number`

4. **`supabase/functions/_shared/tool-executor.ts`**
   - References: `whatsapp_e164`, `phone_e164`, `whatsapp_number`

5. **`supabase/functions/_shared/wa-webhook-shared/wallet/transfer.ts`**
   - References: `whatsapp_e164`

6. **Multiple other files** (see grep results)

### 4. Root Cause

The codebase was written expecting additional columns (`whatsapp_e164`, `phone_e164`, `whatsapp_number`) that were never created in the database schema. The actual schema only has:
- `wa_id` - WhatsApp identifier
- `phone_number` - Phone number

### 5. Fix Strategy

1. Replace all references to `whatsapp_e164` with `wa_id` or `phone_number` (depending on context)
2. Replace all references to `phone_e164` with `phone_number`
3. Replace all references to `whatsapp_number` with `wa_id` or `phone_number`
4. Update any TypeScript interfaces/types to match the actual schema
5. Test all affected functions after fixes

### 6. Next Steps

1. ✅ Identify all files with incorrect column references
2. ⏳ Fix column references in all affected files
3. ⏳ Update TypeScript types/interfaces
4. ⏳ Test fixes
5. ⏳ Monitor logs to verify errors are resolved

