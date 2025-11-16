BEGIN;

-- =====================================================================
-- Drop businesses_deprecated table
-- =====================================================================
-- The businesses table has been migrated to business table
-- Code should use business table directly or businesses view
-- Dropping the deprecated table to clean up schema

DROP TABLE IF EXISTS businesses_deprecated CASCADE;

SELECT 'businesses_deprecated table dropped successfully' as status;

COMMIT;
