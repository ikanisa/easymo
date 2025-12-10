-- Enable PostGIS extension early in migration sequence
-- Required for geography/geometry types used in mobility features

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

COMMIT;
