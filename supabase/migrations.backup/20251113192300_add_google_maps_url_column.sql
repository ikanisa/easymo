-- ============================================================================
-- ADD GOOGLE_MAPS_URL COLUMN TO BUSINESSES TABLE
-- ============================================================================
-- Date: November 13, 2025
-- Purpose: Store Google Maps URLs for coordinate extraction
-- ============================================================================

BEGIN;

-- Add google_maps_url column if it doesn't exist
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_businesses_google_maps_url 
ON businesses(google_maps_url) 
WHERE google_maps_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN businesses.google_maps_url IS 'Google Maps URL for the business location';

-- Log the change
INSERT INTO database_cleanup_audit (phase, action, table_name, notes)
VALUES ('Coordinate Extraction', 'ADD COLUMN', 'businesses', 'Added google_maps_url column for coordinate extraction');

COMMIT;
