-- Fix user_sessions schema mismatch
-- Production has user_id in PK, but code only uses phone_number
-- We need to restructure to match the migration file schema

BEGIN;

-- First, check if user_id exists and is part of primary key
DO $$
DECLARE
    has_user_id_pk BOOLEAN;
BEGIN
    -- Check if user_id is part of primary key
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'user_sessions'
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = 'user_id'
    ) INTO has_user_id_pk;

    IF has_user_id_pk THEN
        -- Drop the old primary key constraint
        ALTER TABLE public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_pkey;
        
        -- Add id column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_sessions' AND column_name = 'id'
        ) THEN
            ALTER TABLE public.user_sessions ADD COLUMN id UUID DEFAULT gen_random_uuid();
        END IF;
        
        -- Make id the new primary key
        ALTER TABLE public.user_sessions ADD PRIMARY KEY (id);
        
        -- Make user_id nullable now that it's not in PK
        ALTER TABLE public.user_sessions ALTER COLUMN user_id DROP NOT NULL;
        
        RAISE NOTICE 'Restructured user_sessions primary key from user_id to id';
    END IF;
END $$;

COMMIT;
