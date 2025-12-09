-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add SACCO support to momo_webhook_endpoints
-- ═══════════════════════════════════════════════════════════════════════════
-- Extends existing momo webhook infrastructure to support SACCO endpoints
-- Links momo_webhook_endpoints to app.saccos
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Add sacco_id column to momo_webhook_endpoints if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'momo_webhook_endpoints'
        AND column_name = 'sacco_id'
    ) THEN
        ALTER TABLE public.momo_webhook_endpoints
        ADD COLUMN sacco_id UUID REFERENCES app.saccos(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update service_type check constraint to include 'sacco'
DO $$
BEGIN
    -- Drop old constraint if exists
    ALTER TABLE public.momo_webhook_endpoints
    DROP CONSTRAINT IF EXISTS momo_webhook_endpoints_service_type_check;
    
    -- Add new constraint with sacco
    ALTER TABLE public.momo_webhook_endpoints
    ADD CONSTRAINT momo_webhook_endpoints_service_type_check
    CHECK (service_type IN ('rides', 'marketplace', 'jobs', 'insurance', 'sacco', 'general'));
END $$;

-- Create index for SACCO webhook lookups
-- Note: Only create WHERE clause if active column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'momo_webhook_endpoints'
        AND column_name = 'active'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_momo_endpoints_sacco_id
        ON public.momo_webhook_endpoints(sacco_id)
        WHERE sacco_id IS NOT NULL AND active = true;
    ELSE
        CREATE INDEX IF NOT EXISTS idx_momo_endpoints_sacco_id
        ON public.momo_webhook_endpoints(sacco_id)
        WHERE sacco_id IS NOT NULL;
    END IF;
END $$;

-- Create index for service type lookups
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'momo_webhook_endpoints'
        AND column_name = 'active'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_momo_endpoints_service_type
        ON public.momo_webhook_endpoints(service_type, active)
        WHERE active = true;
    ELSE
        CREATE INDEX IF NOT EXISTS idx_momo_endpoints_service_type
        ON public.momo_webhook_endpoints(service_type);
    END IF;
END $$;

COMMIT;
