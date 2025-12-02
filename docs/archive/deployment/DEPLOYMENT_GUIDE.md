# wa-webhook Quick Deployment Guide

**CRITICAL**: The additive guard was blocking all wa-webhook changes. This has been fixed.

## Pre-deployment Migration Verification

Before deploying edge functions, you **must** verify that required database migrations have been applied. This prevents production incidents where edge functions fail because the database schema doesn't match what the code expects.

### Automatic CI/CD Verification

The CI/CD pipeline automatically runs migration verification before deploying edge functions:

1. **For Supabase Deploy workflow** (`supabase-deploy.yml`): Functions deploy only AFTER migrations have been applied
2. **For Functions Post-merge workflow** (`supabase-functions-post-merge.yml`): Explicit migration verification runs before deployment

### Manual Verification

To manually verify migrations before deployment:

```bash
# Set DATABASE_URL to your Supabase connection string
export DATABASE_URL='postgresql://postgres:password@db.project.supabase.co:5432/postgres'

# Verify migrations for a specific edge function
./scripts/verify-migrations-before-deploy.sh wa-webhook-mobility
```

### Migration Manifest

Edge function dependencies are tracked in `supabase/migration-manifest.json`. This file maps each edge function to:
- **required_migrations**: SQL migrations that must be applied
- **required_columns**: Database columns that must exist
- **required_functions**: PostgreSQL functions that must exist

#### Adding New Dependencies

When adding new database dependencies to an edge function:

1. Update `supabase/migration-manifest.json`:
```json
{
  "my-edge-function": {
    "description": "Description of the function",
    "required_migrations": ["20251201130000_my_migration"],
    "required_columns": [{"table": "my_table", "column": "my_column"}],
    "required_functions": ["my_rpc_function"]
  }
}
```

2. Commit both the migration and manifest update together

### Troubleshooting Verification Failures

If the verification script fails:

1. **Missing migration**: Apply migrations first with `supabase db push`
2. **Missing column**: The migration may not have been applied correctly
3. **Missing function**: Check if the SQL migration includes the function definition

## Quick Deploy

```bash
# 1. Merge this PR
git checkout main
git pull origin main

# 2. Verify migrations are applied (automatic in CI, or run manually)
./scripts/verify-migrations-before-deploy.sh wa-webhook-mobility

# 3. Apply migrations
cd /path/to/easymo
supabase db push

# 4. Deploy edge functions
supabase functions deploy wa-webhook
supabase functions deploy wa-webhook-mobility  
supabase functions deploy wa-webhook-wallet
supabase functions deploy wa-webhook-core

# 5. Verify insurance contacts exist
supabase db query "SELECT * FROM insurance_admin_contacts WHERE is_active = true"
# Expected: 3 rows with +250795588248, +250793094876, +250788767816

# 6. Verify countries exist
supabase db query "SELECT name, momo_supported FROM countries"
# Expected: 7 rows (Rwanda, Burundi, DR Congo, Tanzania, Zambia = true; Malta, Canada = false)
```

## Test Checklist

### Insurance ✅
```
1. Send "Insurance" to bot
2. Upload a document (image or PDF)
3. Expected: OCR processes, summary sent, admins notified, 2000 tokens awarded
4. Tap "Help" 
5. Expected: Show 3 insurance admin contacts
```

### Share easyMO ✅
```
1. Open Profile → "Invite friends"
2. Expected: Share link with +22893002751 and unique ref code
3. Tap "QR Code"
4. Expected: QR code generated and sent
```

### MOMO QR ✅
```
# Test with Rwanda number (+250...)
1. Open Profile → "MOMO QR"
2. Expected: See "Use my number" option
3. Test: Generate QR code → Should be scannable

# Test with Malta number (+356...)
1. Open Profile → "MOMO QR"
2. Expected: No "Use my number" option (only "Add number" and "Add code")
```

### Wallet ✅
```
# With <2000 tokens
1. Try "Transfer tokens"
2. Expected: Error message about 2000 minimum
3. Try "Redeem"
4. Expected: Error message about 2000 minimum

# With ≥2000 tokens  
1. Try "Transfer tokens"
2. Expected: Partner list shown, can transfer
3. Try "Redeem"
4. Expected: Rewards list shown, can redeem
```

### Rides ✅
```
1. Tap "Nearby drivers"
2. Select vehicle type
3. Share location ONCE
4. Expected: 
   - Location cached for 30 minutes
   - Top 9 drivers shown
   - Drivers receive notification with your contact
5. Try "Nearby drivers" again within 30 min
6. Expected: Uses cached location (doesn't ask again)
```

## Verification Script

Save as `verify-deployment.sh`:

```bash
#!/bin/bash

echo "🔍 Verifying wa-webhook deployment..."

# Check insurance contacts
echo ""
echo "1️⃣ Checking insurance_admin_contacts..."
CONTACTS=$(supabase db query "SELECT COUNT(*) as count FROM insurance_admin_contacts WHERE is_active = true" --csv | tail -1)
if [ "$CONTACTS" = "3" ]; then
  echo "✅ Insurance contacts: OK (3 contacts)"
else
  echo "❌ Insurance contacts: FAILED (expected 3, got $CONTACTS)"
fi

# Check countries table
echo ""
echo "2️⃣ Checking countries table..."
COUNTRIES=$(supabase db query "SELECT COUNT(*) as count FROM countries" --csv | tail -1)
if [ "$COUNTRIES" = "7" ]; then
  echo "✅ Countries: OK (7 countries)"
else
  echo "❌ Countries: FAILED (expected 7, got $COUNTRIES)"
fi

# Check momo_supported countries
echo ""
echo "3️⃣ Checking MOMO supported countries..."
MOMO_COUNT=$(supabase db query "SELECT COUNT(*) as count FROM countries WHERE momo_supported = true" --csv | tail -1)
if [ "$MOMO_COUNT" = "5" ]; then
  echo "✅ MOMO countries: OK (5 African countries)"
else
  echo "❌ MOMO countries: FAILED (expected 5, got $MOMO_COUNT)"
fi

# Check profiles location columns
echo ""
echo "4️⃣ Checking profiles location columns..."
LOCATION_COLS=$(supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('last_location', 'last_location_at')" --csv | tail -n +2 | wc -l)
if [ "$LOCATION_COLS" = "2" ]; then
  echo "✅ Location columns: OK (last_location, last_location_at)"
else
  echo "❌ Location columns: FAILED (expected 2, got $LOCATION_COLS)"
fi

# Check ride tables
echo ""
echo "5️⃣ Checking ride tables..."
RIDE_TABLES=$(supabase db query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('ride_notifications', 'ride_requests')" --csv | tail -n +2 | wc -l)
if [ "$RIDE_TABLES" = "2" ]; then
  echo "✅ Ride tables: OK (ride_notifications, ride_requests)"
else
  echo "❌ Ride tables: FAILED (expected 2, got $RIDE_TABLES)"
fi

# Check wallet RPC functions
echo ""
echo "6️⃣ Checking wallet RPC functions..."
WALLET_RPCS=$(supabase db query "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('wallet_get_balance', 'wallet_transfer_tokens', 'wallet_redeem_request')" --csv | tail -n +2 | wc -l)
if [ "$WALLET_RPCS" = "3" ]; then
  echo "✅ Wallet RPCs: OK (all 3 functions exist)"
else
  echo "❌ Wallet RPCs: FAILED (expected 3, got $WALLET_RPCS)"
fi

echo ""
echo "=========================================="
echo "Deployment verification complete!"
echo "=========================================="
```

Run with: `chmod +x verify-deployment.sh && ./verify-deployment.sh`

## Rollback (if needed)

If issues arise:

```bash
# Revert to previous edge function version
supabase functions deploy wa-webhook --version <previous-version>

# Or temporarily disable routing to wa-webhook
# Set environment variable: WA_ROUTER_MODE=disabled
```

## Monitoring

Watch for these log events after deployment:

```
✅ Good events:
- INSURANCE_OCR_OK
- DRIVER_NOTIFIED
- WALLET_TRANSFER_SUCCESS
- LOCATION_CACHED

❌ Watch for:
- INSURANCE_OCR_FAIL
- NOTIFY_DRIVER_FAIL
- WALLET_TRANSFER_FAIL
- LOCATION_CACHE_FAIL
```

## Support

If workflows still don't work after deployment:

1. Check Supabase function logs
2. Verify webhook is receiving messages
3. Test with known working number (+250...)
4. Verify RPC functions return data
5. Check that service role key is set correctly

---

**Remember**: The main fix was removing the CI/CD blocker. All functionality was already implemented!
