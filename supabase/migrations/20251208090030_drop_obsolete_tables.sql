-- Run only after code is fully cut over to public.trips
BEGIN;

-- Drop obsolete match/payments/metrics/audit tables
DROP TABLE IF EXISTS mobility_trip_matches CASCADE;
DROP TABLE IF EXISTS mobility_matches CASCADE;
DROP TABLE IF EXISTS trip_payment_requests CASCADE;
DROP TABLE IF EXISTS trip_status_audit CASCADE;
DROP TABLE IF EXISTS trip_ratings CASCADE;
DROP TABLE IF EXISTS mobility_driver_metrics CASCADE;
DROP TABLE IF EXISTS mobility_passenger_metrics CASCADE;

-- Drop legacy scheduling tables
DROP TABLE IF EXISTS scheduled_trips CASCADE;
DROP TABLE IF EXISTS rides_trips CASCADE;
DROP TABLE IF EXISTS recurring_trips CASCADE;

-- Drop legacy trips if conflicting
-- DROP TABLE IF EXISTS trips_old CASCADE; -- (uncomment if such a table exists)

COMMIT;
