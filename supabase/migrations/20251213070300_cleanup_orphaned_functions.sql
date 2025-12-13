-- ============================================================================
-- CLEANUP ORPHANED FUNCTIONS
-- Keep only functions needed by the `business` table
-- ============================================================================

BEGIN;

DO $$
DECLARE
    functions_to_keep TEXT[] := ARRAY[
        -- PostGIS functions (thousands, handled by extension)
        -- Business table functions
        'update_business_location_geography',
        'update_business_search_vector'
    ];
    
    func_rec RECORD;
    drop_count INTEGER := 0;
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'CLEANING UP ORPHANED FUNCTIONS';
    RAISE NOTICE '============================================';
    
    FOR func_rec IN 
        SELECT 
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname NOT LIKE 'st\_%'  -- Skip PostGIS (st_*)
        AND p.proname NOT LIKE '_st%'   -- Skip PostGIS internal
        AND p.proname NOT LIKE 'postgis%' -- Skip PostGIS
        AND p.proname NOT LIKE 'geography%' -- Skip PostGIS
        AND p.proname NOT LIKE 'geometry%' -- Skip PostGIS
        AND p.proname NOT LIKE 'box%' -- Skip PostGIS
        AND p.proname NOT LIKE 'path%' -- Skip PostGIS
        AND p.proname NOT LIKE 'point%' -- Skip PostGIS
        AND p.proname NOT LIKE 'polygon%' -- Skip PostGIS
        AND p.proname NOT LIKE 'line%' -- Skip PostGIS
        AND p.proname NOT LIKE 'circle%' -- Skip PostGIS
        ORDER BY p.proname
    LOOP
        -- Skip functions we want to keep
        IF func_rec.function_name = ANY(functions_to_keep) THEN
            RAISE NOTICE '✅ KEEPING: %', func_rec.function_name;
            CONTINUE;
        END IF;
        
        -- Drop the function
        RAISE NOTICE '🗑️  DROPPING: %(%)', func_rec.function_name, func_rec.args;
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', 
                          func_rec.function_name, func_rec.args);
            drop_count := drop_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '   ⚠️  Could not drop: %', SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '🗑️  Functions dropped: %', drop_count;
    RAISE NOTICE '============================================';
END $$;

-- Verify remaining functions
SELECT proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname NOT LIKE 'st\_%'
AND proname NOT LIKE 'postgis%'
AND proname NOT LIKE 'geography%'
AND proname NOT LIKE 'geometry%'
ORDER BY proname;

COMMIT;
