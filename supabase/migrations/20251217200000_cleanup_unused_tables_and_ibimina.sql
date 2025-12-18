-- Migration: Cleanup Unused Tables and Delete Ibimina System
-- Purpose: Remove unused mobility tables, old menu system, and entire Ibimina/SACCO system
-- Date: 2025-12-17

BEGIN;

-- ============================================================
-- 1. DELETE IBIMINA/SACCO SYSTEM TABLES (18 tables)
-- ============================================================

-- Drop Ibimina wallet tables
DROP TABLE IF EXISTS public.wallet_accounts_ibimina CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions_ibimina CASCADE;

-- Drop SACCO organization tables
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.share_allocations CASCADE;
DROP TABLE IF EXISTS public.allocation_export_requests CASCADE;

-- Drop payment and reconciliation tables
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.settlements CASCADE;
DROP TABLE IF EXISTS public.reconciliation_runs CASCADE;
DROP TABLE IF EXISTS public.reconciliation_exceptions CASCADE;

-- Drop SMS system tables
DROP TABLE IF EXISTS public.sms_inbox CASCADE;
DROP TABLE IF EXISTS public.sms_parsed CASCADE;
DROP TABLE IF EXISTS public.sms_templates CASCADE;
DROP TABLE IF EXISTS public.sms_review_queue CASCADE;

-- Drop configuration tables
DROP TABLE IF EXISTS public.configuration CASCADE;
DROP TABLE IF EXISTS public.org_feature_overrides CASCADE;

-- ============================================================
-- 2. DELETE UNUSED MOBILITY TABLES (replaced by simplified system)
-- ============================================================

DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.location_cache CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;

-- ============================================================
-- 3. DELETE OLD MENU SYSTEM
-- ============================================================

DROP TABLE IF EXISTS public.menu_items CASCADE;

-- ============================================================
-- 4. CREATE MISSING wallet_accounts TABLE (if not exists)
-- ============================================================

-- wallet_accounts is referenced by wallet_delta_fn and code
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_profile_id ON public.wallet_accounts(profile_id);

-- Enable RLS
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_accounts' AND policyname = 'users_view_own_wallet') THEN
        CREATE POLICY "users_view_own_wallet" ON public.wallet_accounts 
            FOR SELECT USING (auth.uid() = profile_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_accounts' AND policyname = 'service_role_manage_wallet') THEN
        CREATE POLICY "service_role_manage_wallet" ON public.wallet_accounts 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ============================================================
-- 5. DELETE UNUSED FUNCTIONS
-- ============================================================

-- Delete old mobility functions
DROP FUNCTION IF EXISTS public.create_trip CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_trips CASCADE;

-- Delete old trigger function
DROP FUNCTION IF EXISTS public.trips_set_updated_at CASCADE;

-- ============================================================
-- 6. CLEANUP COMMENTS
-- ============================================================

COMMENT ON SCHEMA public IS 'EasyMO WhatsApp platform schema - Ibimina/SACCO system removed';
COMMENT ON TABLE public.wallet_accounts IS 'User token balances - used by wallet system';

COMMIT;

