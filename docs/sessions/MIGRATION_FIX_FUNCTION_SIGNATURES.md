# Migration Fix - Function Signature Conflict Resolved

## Issue

```
ERROR: cannot change return type of existing function (SQLSTATE 42P13)
```

The function `get_cached_location` already exists in production with a different return type
signature.

## Root Cause

PostgreSQL doesn't allow `CREATE OR REPLACE FUNCTION` to change the return type of an existing
function. The existing function must be dropped first.

## Fix Applied

Added DROP statements at the beginning of the RPC functions section:

```sql
-- Drop existing functions that may have different signatures
DROP FUNCTION IF EXISTS public.save_recent_location(uuid, numeric, numeric, text, jsonb, integer);
DROP FUNCTION IF EXISTS public.get_recent_location(uuid, text, integer);
DROP FUNCTION IF EXISTS public.has_recent_location(uuid, integer);
DROP FUNCTION IF EXISTS public.update_user_location_cache(uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.get_cached_location(uuid, integer);
DROP FUNCTION IF EXISTS public.save_favorite_location(uuid, text, numeric, numeric, text, text);
DROP FUNCTION IF EXISTS public.get_saved_location(uuid, text);
DROP FUNCTION IF EXISTS public.list_saved_locations(uuid);
```

## What This Means

The existing `get_cached_location` function in production has a DIFFERENT signature than our new
one. This confirms that:

1. Someone created a location cache function manually
2. It has a different return type than our standardized version
3. Our migration will replace it with the correct version

## Next Step

Run the deployment again:

```bash
supabase db push
# Type 'y' when prompted
```

This should now succeed!

## Status

✅ Migration file updated with DROP statements ✅ Ready to deploy
