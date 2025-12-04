#!/bin/bash
# Mobility V2 Migration - Backfill Historical Data
#
# This script copies historical data from V1 to V2 schema
# Run AFTER dual-write is enabled and tested

set -e

echo "🚀 Starting Mobility V2 data backfill..."

# Configuration
DB_URL="${DATABASE_URL:-}"
BATCH_SIZE="${BATCH_SIZE:-1000}"
START_DATE="${START_DATE:-2024-01-01}"

if [ -z "$DB_URL" ]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

echo "📊 Configuration:"
echo "  Batch size: $BATCH_SIZE"
echo "  Start date: $START_DATE"
echo ""

# Function to run SQL
run_sql() {
  psql "$DB_URL" -c "$1"
}

# Step 1: Backfill mobility_trips from mobility_intents
echo "1️⃣ Backfilling mobility_trips..."
run_sql "
INSERT INTO mobility_trips (
  id,
  creator_user_id,
  role,
  vehicle_type,
  pickup_lat,
  pickup_lng,
  pickup_text,
  dropoff_lat,
  dropoff_lng,
  dropoff_text,
  expires_at,
  status,
  created_at
)
SELECT
  id,
  creator_user_id,
  role,
  vehicle_type,
  pickup_lat,
  pickup_lng,
  pickup_text,
  dropoff_lat,
  dropoff_lng,
  dropoff_text,
  expires_at,
  status,
  created_at
FROM mobility_intents
WHERE created_at >= '$START_DATE'
  AND NOT EXISTS (
    SELECT 1 FROM mobility_trips mt WHERE mt.id = mobility_intents.id
  )
ORDER BY created_at
LIMIT $BATCH_SIZE
ON CONFLICT (id) DO NOTHING;
"

# Get count
TRIPS_MIGRATED=$(run_sql "SELECT COUNT(*) FROM mobility_trips WHERE created_at >= '$START_DATE';" -t)
echo "   ✅ Migrated $TRIPS_MIGRATED trips"

# Step 2: Initialize driver metrics
echo "2️⃣ Initializing driver metrics..."
run_sql "
INSERT INTO mobility_driver_metrics (
  user_id,
  total_trips,
  completed_trips,
  cancelled_trips,
  acceptance_rate,
  avg_rating
)
SELECT
  creator_user_id,
  COUNT(*) as total_trips,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_trips,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_trips,
  100.0 as acceptance_rate, -- Default
  4.5 as avg_rating -- Default
FROM mobility_trips
WHERE role = 'driver'
  AND created_at >= '$START_DATE'
GROUP BY creator_user_id
ON CONFLICT (user_id) DO UPDATE SET
  total_trips = EXCLUDED.total_trips,
  completed_trips = EXCLUDED.completed_trips,
  cancelled_trips = EXCLUDED.cancelled_trips;
"

DRIVERS_MIGRATED=$(run_sql "SELECT COUNT(*) FROM mobility_driver_metrics;" -t)
echo "   ✅ Initialized $DRIVERS_MIGRATED driver metrics"

# Step 3: Initialize passenger metrics
echo "3️⃣ Initializing passenger metrics..."
run_sql "
INSERT INTO mobility_passenger_metrics (
  user_id,
  total_trips,
  completed_trips,
  cancelled_trips,
  avg_rating
)
SELECT
  creator_user_id,
  COUNT(*) as total_trips,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_trips,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_trips,
  4.5 as avg_rating -- Default
FROM mobility_trips
WHERE role = 'passenger'
  AND created_at >= '$START_DATE'
GROUP BY creator_user_id
ON CONFLICT (user_id) DO UPDATE SET
  total_trips = EXCLUDED.total_trips,
  completed_trips = EXCLUDED.completed_trips,
  cancelled_trips = EXCLUDED.cancelled_trips;
"

PASSENGERS_MIGRATED=$(run_sql "SELECT COUNT(*) FROM mobility_passenger_metrics;" -t)
echo "   ✅ Initialized $PASSENGERS_MIGRATED passenger metrics"

# Step 4: Verify data consistency
echo "4️⃣ Verifying data consistency..."
V1_COUNT=$(run_sql "SELECT COUNT(*) FROM mobility_intents WHERE created_at >= '$START_DATE';" -t)
V2_COUNT=$(run_sql "SELECT COUNT(*) FROM mobility_trips WHERE created_at >= '$START_DATE';" -t)

echo "   V1 trips: $V1_COUNT"
echo "   V2 trips: $V2_COUNT"

if [ "$V1_COUNT" -eq "$V2_COUNT" ]; then
  echo "   ✅ Data consistency verified"
else
  echo "   ⚠️ Data mismatch detected! Manual verification needed."
fi

# Step 5: Update migration status
echo "5️⃣ Updating migration status..."
run_sql "
UPDATE mobility_migration_status
SET status = 'completed', completed_at = now()
WHERE phase = 'backfill';
"

echo ""
echo "✅ Backfill complete!"
echo ""
echo "📈 Summary:"
echo "  Trips: $TRIPS_MIGRATED"
echo "  Drivers: $DRIVERS_MIGRATED"
echo "  Passengers: $PASSENGERS_MIGRATED"
echo ""
echo "Next steps:"
echo "  1. Verify data in V2 tables"
echo "  2. Run consistency checks"
echo "  3. Test V2 services with real data"
echo "  4. Enable V2 reads (gradual cutover)"
