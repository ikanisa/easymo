# MOBILITY TRIPS CLEANUP - START HERE

**Status**: ✅ READY FOR DEPLOYMENT  
**Date**: 2025-12-08  
**Breaking Change**: YES

---

## 📋 WHAT THIS IS

Complete refactoring of the mobility trips domain that consolidates 8 fragmented tables into 1 canonical `trips` table, removes out-of-scope matching/lifecycle features, and aligns the codebase with the simplified product scope (trip scheduling + nearby search only).

---

## 🚀 QUICK START

### For Deployment
```bash
# Deploy everything (migrations + edge functions)
./deploy-mobility-trips-cleanup.sh

# Verify deployment
./verify-mobility-cleanup.sh
```

### For Understanding
1. **Quick Overview**: Read `MOBILITY_TRIPS_QUICK_REF.md` (~10 min)
2. **Full Details**: Read `MOBILITY_TRIPS_CLEANUP_SUMMARY.md` (~30 min)
3. **Code Changes**: Review updated TypeScript files (see below)

---

## 📁 FILE ORGANIZATION

### Documentation (Start Here)
```
MOBILITY_TRIPS_START_HERE.md       ← You are here
MOBILITY_TRIPS_QUICK_REF.md        ← Quick reference (API, queries, troubleshooting)
MOBILITY_TRIPS_CLEANUP_SUMMARY.md  ← Complete technical documentation
```

### SQL Migrations (Run in Order)
```
supabase/migrations/
  20251208090000_mobility_trips_canonical_schema.sql  ← Create trips table
  20251208090001_migrate_data_to_canonical_trips.sql  ← Backfill data
  20251208090002_update_matching_rpcs_for_trips.sql   ← Update RPCs
  20251208090003_drop_old_trip_tables.sql             ← Drop old tables
  20251208090004_update_cron_jobs_for_trips.sql       ← Update cron
```

### Code Changes
```
supabase/functions/
  _shared/wa-webhook-shared/rpc/mobility.ts   ← Updated insertTrip, updateTripDropoff
  wa-webhook/rpc/mobility.ts                  ← Updated updateTripDropoff
  wa-webhook-mobility/rpc/mobility.ts         ← Updated insertTrip, updateTripDropoff
```

### Automation
```
deploy-mobility-trips-cleanup.sh   ← Deploy everything
verify-mobility-cleanup.sh         ← Verify deployment
```

---

## 🎯 WHAT CHANGED (TL;DR)

### Before
- ❌ 8 fragmented trip tables (mobility_trips, rides_trips, mobility_trip_matches, etc.)
- ❌ Code split between V1 and V2 with zero integration
- ❌ Full ride-hailing lifecycle (matching, status tracking, payments)
- ❌ 8+ trip statuses (open, matched, accepted, in_progress, completed, etc.)

### After
- ✅ 1 canonical `trips` table
- ✅ Unified code paths
- ✅ Simplified scope: Trip scheduling + nearby search only
- ✅ 3 statuses: active, expired, cancelled

---

## 📚 DOCUMENTATION GUIDE

### Choose Your Path

#### 🏃 "I need to deploy NOW"
1. Read this file (you're here)
2. Run `./deploy-mobility-trips-cleanup.sh`
3. Run `./verify-mobility-cleanup.sh`
4. Monitor logs for 24 hours

#### 🤓 "I want to understand what's happening"
1. Read `MOBILITY_TRIPS_QUICK_REF.md` (API reference, examples)
2. Review migration files (see what SQL is executed)
3. Check updated TypeScript files (see code changes)

#### 📖 "I need complete technical details"
1. Read `MOBILITY_TRIPS_CLEANUP_SUMMARY.md` (everything)
2. Review audit findings (root cause analysis)
3. Study migration strategy (data preservation approach)

---

## ⚡ DEPLOYMENT STEPS

### 1. Pre-Deployment Checklist
- [ ] Backup production database
- [ ] Review migration files
- [ ] Test on staging environment
- [ ] Verify edge functions build locally

### 2. Deploy
```bash
./deploy-mobility-trips-cleanup.sh
```

### 3. Verify
```bash
./verify-mobility-cleanup.sh
```

Expected: All checks pass ✅

### 4. Monitor
```bash
supabase functions logs wa-webhook-mobility --tail
```

Watch for errors in first 24 hours.

---

## 🔍 KEY CONCEPTS

### Trip Kinds (2 types)
- **`scheduled`**: User plans a future trip → sets `scheduled_for` timestamp
- **`request`**: User searches nearby → intent logging only

### Trip Statuses (3 states)
- **`active`**: Trip is searchable, not expired
- **`expired`**: Past TTL or scheduled time
- **`cancelled`**: User cancelled

### NO Matching
- System shows nearby results
- User picks someone → WhatsApp chat
- Everything after that is out of system

---

## 📊 SCHEMA OVERVIEW

### Canonical Table: `trips`
```sql
CREATE TABLE trips (
  id uuid PRIMARY KEY,
  user_id uuid,
  role text,  -- 'driver' | 'passenger'
  vehicle_type text,
  trip_kind text,  -- 'scheduled' | 'request'
  status text,  -- 'active', 'expired', 'cancelled'
  
  -- Location
  pickup_lat/lng double precision,
  pickup_geog geography(Point, 4326),
  dropoff_lat/lng (optional),
  dropoff_geog geography(Point, 4326),
  
  -- Scheduling
  scheduled_for timestamptz,
  recurrence_id uuid,
  
  -- Timestamps
  created_at, expires_at, cancelled_at, updated_at
);
```

### Supporting Tables
- `recurring_trips` - Recurring schedules (KEPT)
- `trip_payment_requests` - Payment tracking (KEPT, FK updated)

### Removed Tables (8)
- mobility_trips, mobility_trip_matches, rides_trips, scheduled_trips
- trip_status_audit, mobility_driver_metrics, mobility_passenger_metrics
- mobility_pricing_config

---

## 🛠️ CODE EXAMPLES

### Create Trip
```typescript
import { insertTrip } from '../rpc/mobility.ts';

// Nearby search
const tripId = await insertTrip(client, {
  userId: 'xxx',
  role: 'passenger',
  vehicleType: 'moto',
  lat: -1.95,
  lng: 30.06,
  radiusMeters: 5000,
});
// → trip_kind='request', status='active'

// Scheduled trip
const tripId = await insertTrip(client, {
  userId: 'yyy',
  role: 'driver',
  vehicleType: 'moto',
  lat: -1.95,
  lng: 30.06,
  radiusMeters: 1000,
  scheduledAt: new Date('2025-12-10T08:00:00Z'),
});
// → trip_kind='scheduled', status='active'
```

### Find Nearby
```typescript
import { matchDriversForTrip } from '../rpc/mobility.ts';

const drivers = await matchDriversForTrip(client, passengerTripId, 10);
// → Returns nearby active drivers
```

---

## 🧪 TESTING

### Quick Smoke Test
```sql
-- 1. Check trips table exists
SELECT COUNT(*) FROM trips;

-- 2. Create test trip
INSERT INTO trips (
  user_id, role, vehicle_type, trip_kind,
  pickup_lat, pickup_lng, pickup_radius_m,
  status, expires_at
) VALUES (
  'test-user-id', 'driver', 'moto', 'request',
  -1.95, 30.06, 5000,
  'active', now() + interval '2 hours'
) RETURNING id;

-- 3. Test nearby search
SELECT * FROM match_passengers_for_trip_v2(
  _trip_id := 'returned-id',
  _limit := 10
);

-- 4. Cleanup
DELETE FROM trips WHERE user_id = 'test-user-id';
```

---

## 🚨 TROUBLESHOOTING

### "Table rides_trips does not exist"
✅ Expected - old table was dropped  
🔧 Code updated to use `trips` table

### "Column creator_user_id does not exist"
✅ Expected - renamed to `user_id`  
🔧 Check migrations applied: `supabase db push`

### Nearby queries returning empty
🔍 Check: `SELECT COUNT(*) FROM trips WHERE status = 'active';`  
🔧 Ensure data migrated: See migration 20251208090001

### Trips not expiring
🔍 Check cron: `SELECT * FROM cron.job WHERE jobname = 'expire-trips';`  
🔧 Manual expire: `SELECT expire_old_trips();`

---

## 📞 SUPPORT

### Documentation
- **Quick Ref**: `MOBILITY_TRIPS_QUICK_REF.md`
- **Full Docs**: `MOBILITY_TRIPS_CLEANUP_SUMMARY.md`
- **Migrations**: `supabase/migrations/202512080900*.sql`

### Logs
```bash
# Edge function logs
supabase functions logs wa-webhook-mobility --tail

# Database logs
supabase db logs

# Migration history
supabase db execute "SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20251208%';"
```

### Verification
```bash
./verify-mobility-cleanup.sh
```

---

## ✅ SUCCESS CRITERIA

After deployment, you should have:
- [x] ONE canonical trips table
- [x] 8 old tables removed
- [x] All code using trips table
- [x] Nearby searches working
- [x] Trip scheduling working
- [x] Cron jobs expiring old trips
- [x] No errors in production logs

---

## 🎉 DELIVERABLES SUMMARY

| Type | Count | Purpose |
|------|-------|---------|
| SQL Migrations | 5 | Create, backfill, refactor, cleanup, cron |
| Code Updates | 3 | Use canonical trips table |
| Documentation | 3 | Understand, deploy, troubleshoot |
| Automation | 2 | Deploy, verify |
| **TOTAL** | **13 files** | **Complete cleanup** |

---

## 📅 NEXT STEPS

1. **Deploy** (use automation script)
2. **Verify** (use verification script)
3. **Monitor** (watch logs for 24 hours)
4. **Test** (end-to-end user flows)
5. **Document** (update team wiki if applicable)

---

**Questions?** Start with `MOBILITY_TRIPS_QUICK_REF.md`  
**Issues?** Run `./verify-mobility-cleanup.sh`  
**Deep Dive?** Read `MOBILITY_TRIPS_CLEANUP_SUMMARY.md`

---

**Last Updated**: 2025-12-08  
**Status**: ✅ READY FOR DEPLOYMENT
