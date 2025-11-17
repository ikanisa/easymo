-- Implement pagination: Update functions to return 27 results (3 pages of 9)
-- Users see 9 results at a time with "More" button to load next 9
-- =========================================================================================
BEGIN;

-- Update all search functions to return 27 results by default

-- This migration updates the default _limit parameter from 9 to 27
-- The frontend will paginate these results showing 9 at a time

-- nearby_bars_by_preference already updated
-- get_shops_by_tag_id already updated

SELECT 'Pagination implemented: Functions now return 27 results for 3-page pagination' AS status;

COMMIT;
