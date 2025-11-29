-- Transaction wrapper for production safety
BEGIN;

-- Enable PostGIS extension for geographic data support
CREATE EXTENSION IF NOT EXISTS postgis;

COMMIT;
