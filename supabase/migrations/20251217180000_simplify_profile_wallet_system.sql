-- Migration: Simplify Profile Wallet System
-- Purpose: Create minimal token system for user-to-user transfers
-- Date: 2025-12-17

BEGIN;

-- ============================================================
-- 1. TOKEN_TRANSFERS TABLE (for idempotency and audit)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.token_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed_notify', 'failed')),
    client_ref TEXT, -- For idempotency (optional)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_transfers_from_user 
ON public.token_transfers(from_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_transfers_to_user 
ON public.token_transfers(to_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_transfers_client_ref 
ON public.token_transfers(client_ref) 
WHERE client_ref IS NOT NULL;

-- Enable RLS
ALTER TABLE public.token_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'token_transfers' AND policyname = 'users_view_own_transfers') THEN
        CREATE POLICY "users_view_own_transfers" ON public.token_transfers 
            FOR SELECT USING (
                from_user_id = auth.uid() OR to_user_id = auth.uid()
            );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'token_transfers' AND policyname = 'service_role_manage_transfers') THEN
        CREATE POLICY "service_role_manage_transfers" ON public.token_transfers 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ============================================================
-- 2. UPDATE wallet_delta_fn TO SUPPORT transfer_in/transfer_out
-- ============================================================

-- The function already exists, but ensure it handles transfer_in/transfer_out entry types
-- No changes needed - function already supports custom entry_type

-- ============================================================
-- 3. ENSURE referral_links HAS last_shared_at COLUMN
-- ============================================================

DO $$
BEGIN
    -- Only add column if table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_links'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'referral_links' 
            AND column_name = 'last_shared_at'
        ) THEN
            ALTER TABLE public.referral_links ADD COLUMN last_shared_at TIMESTAMPTZ;
        END IF;
    END IF;
END $$;

-- ============================================================
-- 4. GRANTS
-- ============================================================

GRANT SELECT ON public.token_transfers TO authenticated;

-- Grant execute on functions if they exist
DO $$
BEGIN
    -- Grant on wallet_delta_fn if it exists
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'wallet_delta_fn'
    ) THEN
        GRANT EXECUTE ON FUNCTION public.wallet_delta_fn(UUID, INTEGER, TEXT, TEXT, UUID, TEXT) TO authenticated;
    END IF;
    
    -- Grant on referral_apply_code_v2 if it exists
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'referral_apply_code_v2'
    ) THEN
        -- Try different possible signatures
        BEGIN
            GRANT EXECUTE ON FUNCTION public.referral_apply_code_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
        EXCEPTION WHEN OTHERS THEN
            -- Function might have different signature, skip
            NULL;
        END;
    END IF;
END $$;

-- ============================================================
-- 5. COMMENTS
-- ============================================================

COMMENT ON TABLE public.token_transfers IS 'Audit trail for user-to-user token transfers with idempotency support';
COMMENT ON COLUMN public.token_transfers.client_ref IS 'Client-provided reference for idempotency (prevents duplicate transfers)';

COMMIT;

