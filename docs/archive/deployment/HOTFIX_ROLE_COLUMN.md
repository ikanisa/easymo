# 🔥 HOTFIX: Role Column Added

**Date:** 2025-11-23 13:22 UTC  
**Issue:** "Could not find the 'role' column of 'profiles' in the schema cache"  
**Status:** ✅ FIXED

---

## Problem Identified

From logs at 13:21 UTC:
```json
{"event":"PROFILE_UPSERT_FAILED","payload":{
  "masked_phone":"***6193",
  "error":"Could not find the 'role' column of 'profiles' in the schema cache",
  "error_code":"PGRST204"
}}
```

**Root Cause:** Code in `state/store.ts` line 162 tries to upsert `role: "buyer"` but column didn't exist.

---

## Fix Applied

### 1. Added role column directly to database:
```sql
ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'buyer';
```

### 2. Created migration file:
`supabase/migrations/20251123155000_add_profile_role_column.sql`

### 3. Recorded in migrations table:
Migration version 20251123155000 tracked.

---

## Verification

All required profile columns now exist:
- ✅ `locale` (default: 'en')
- ✅ `referral_code`
- ✅ `role` (default: 'buyer') ⭐ NEW
- ✅ `vehicle_plate`
- ✅ `vehicle_type`

---

## Impact

**Before:** Profile upserts failed with PGRST204 error  
**After:** Profile creation should work without errors

---

## What to Monitor

Watch logs for:
- ✅ No more "Could not find the 'role' column" errors
- ✅ "PROFILE_ENSURED" success events
- ✅ "WHATSAPP_USER_CREATED" for new users

Check with:
```bash
supabase functions logs wa-webhook --follow | grep -E "(PROFILE_UPSERT|PROFILE_ENSURED)"
```

---

**Status:** ✅ DEPLOYED AND VERIFIED  
**Time to fix:** 2 minutes  
**Migration:** 20251123155000
