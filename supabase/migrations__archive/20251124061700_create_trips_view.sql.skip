-- Migration: Create trips view as alias for rides_trips
-- Date: 2025-11-24
-- Purpose: Backward compatibility - trips references should use rides_trips

BEGIN;

-- Create trips as a view to rides_trips for backward compatibility
CREATE OR REPLACE VIEW public.trips AS
SELECT * FROM public.rides_trips;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT SELECT ON public.trips TO anon;

COMMENT ON VIEW public.trips IS 'Backward compatibility view - use rides_trips table instead';

COMMIT;
