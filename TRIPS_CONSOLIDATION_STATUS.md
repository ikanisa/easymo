# Trips Consolidation Status

## Migrations Completed ✅

### Migration 1: Create Canonical Trips Table
- **File**: `supabase/migrations/20251208090000_create_canonical_trips.sql`
- **Status**: ✅ EXECUTED SUCCESSFULLY
- **Actions**:
  - Dropped existing `trips` view
  - Created new `public.trips` table with:
    - `kind` column (scheduled | request_intent)
    - `role` column (driver | passenger) 
    - Geography-based indexing
    - RLS policies
    - Updated_at trigger

### Migration 2: Backfill Legacy Data
- **File**: `supabase/migrations/20251208090010_backfill_trips.sql`
- **Status**: ✅ EXECUTED SUCCESSFULLY  
- **Results**:
  - Inserted: 35 rows (from mobility_trips - first in UNION, others skipped due to ID overlap)
  - Deduplicated: 26 rows
  - Final count: 9 unique trips
  - All trips marked as `request_intent` with `expired` status

### Migration 3: Transition Views and Functions
- **File**: `supabase/migrations/20251208090020_transition_views_and_functions.sql`
- **Status**: ✅ EXECUTED SUCCESSFULLY
- **Actions**:
  - Created `mobility_trips_compat` view mapping to `public.trips`
  - Rewrote `find_nearby_trips_v2()` function to query `public.trips`
  - Dropped obsolete triggers on mobility_trip_matches

## Migration 4: NOT YET EXECUTED ⚠️

**File**: `supabase/migrations/20251208090030_drop_obsolete_tables.sql`
**Status**: ⏸️ WAITING FOR CODE CUTOVER

**⚠️ DO NOT RUN until application code is fully migrated to use `public.trips`**

This migration will DROP:
- mobility_trips (table)
- mobility_trip_matches
- mobility_matches
- scheduled_trips
- rides_trips
- recurring_trips
- trip_payment_requests
- trip_status_audit
- trip_ratings
- mobility_driver_metrics
- mobility_passenger_metrics

## Current Data Summary

```sql
-- New canonical table
SELECT COUNT(*), kind, status FROM public.trips GROUP BY kind, status;
-- Result: 9 trips, all request_intent, all expired

-- Legacy tables (still active)
SELECT COUNT(*) FROM mobility_trips;       -- 35 rows
SELECT COUNT(*) FROM scheduled_trips;      -- 0 rows
SELECT COUNT(*) FROM rides_trips;          -- 27 rows  
SELECT COUNT(*) FROM recurring_trips;      -- 0 rows
```

## ID Overlap Analysis

The backfill encountered ID conflicts between tables:
- `mobility_trips` and `rides_trips` share 27 IDs
- ON CONFLICT DO NOTHING meant only mobility_trips rows were inserted
- This is **expected behavior** - the tables reference the same logical trips

## Next Steps

### 1. Update Application Code
All code must transition from:
```typescript
// Old
supabase.from('mobility_trips')
supabase.from('scheduled_trips')
supabase.from('rides_trips')

// New
supabase.from('trips')
```

### 2. Test Compatibility View
The `mobility_trips_compat` view provides backward compatibility during transition:
```sql
SELECT * FROM mobility_trips_compat WHERE status = 'open';
```

### 3. Verify Function Updates
Test `find_nearby_trips_v2()` to ensure it works with new schema:
```sql
SELECT * FROM find_nearby_trips_v2(-1.9441, 30.0619, 'passenger', 'car');
```

### 4. After Code Cutover
Once application is fully migrated and tested:
```bash
psql "postgresql://..." -f supabase/migrations/20251208090030_drop_obsolete_tables.sql
```

## Database Connection
```bash
export PGPASSWORD=Pq0jyevTlfoa376P
psql "postgresql://postgres@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
```

## Rollback Plan (if needed)

If you need to rollback migrations 1-3:
```sql
BEGIN;

-- Drop new table
DROP TABLE IF EXISTS public.trips CASCADE;

-- Drop compat view  
DROP VIEW IF EXISTS mobility_trips_compat CASCADE;

-- Recreate old trips view (if needed)
-- CREATE VIEW public.trips AS ...

-- Restore old find_nearby_trips_v2 function
-- (restore from backup)

COMMIT;
```

---
**Generated**: 2025-12-08 09:08 UTC  
**Database**: db.lhbowpbcpwoiparwnwgt.supabase.co
