# ensure_whatsapp_user Function Fix

## Issue
The function was throwing error: `column reference "user_id" is ambiguous - 42702`

## Root Cause
In the `ON CONFLICT DO UPDATE SET` clause, using table-qualified column names like `profiles.wa_id` combined with the `RETURNING` clause was causing PostgreSQL to see ambiguity with the `user_id` column.

## Fix Applied
1. **Migration**: `fix_ensure_whatsapp_user_on_conflict_qualified`
2. **Change**: In the `ON CONFLICT DO UPDATE SET` clause, use `EXCLUDED.column_name` for new values and `profiles.column_name` for existing row values
3. **RETURNING clause**: Use table-qualified names `profiles.id`, `profiles.user_id`, etc. to be explicit

## Function Signature
```sql
ensure_whatsapp_user(_wa_id TEXT, _profile_name TEXT DEFAULT NULL)
RETURNS TABLE (profile_id UUID, user_id UUID, locale TEXT)
```

## Status
✅ Migration applied successfully
✅ Function tested - no errors
✅ Ready for production use

## Next Steps
1. Monitor logs to ensure the error no longer occurs
2. Test with real phone numbers to verify profile creation works
3. Verify that profile webhook errors are resolved

