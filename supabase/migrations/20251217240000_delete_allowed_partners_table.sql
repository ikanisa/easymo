-- Migration: Delete allowed_partners table
-- Purpose: Remove unused allowed_partners table and related objects
-- Date: 2025-12-17
--
-- This table was created but never used in the codebase.
-- Token transfers allow transfers to any user, not restricted to partners.

BEGIN;

-- ============================================================
-- 1. DROP TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS allowed_partners_set_updated_at ON public.allowed_partners;

-- ============================================================
-- 2. DROP FUNCTION (if only used by this table)
-- ============================================================

-- Check if function is used by other tables before dropping
-- For now, we'll drop it since it's specific to allowed_partners
DROP FUNCTION IF EXISTS public.allowed_partners_set_updated_at() CASCADE;

-- ============================================================
-- 3. DROP POLICIES
-- ============================================================

DROP POLICY IF EXISTS "service_role_manage_partners" ON public.allowed_partners;
DROP POLICY IF EXISTS "users_view_active_partners" ON public.allowed_partners;

-- ============================================================
-- 4. DROP INDEXES
-- ============================================================

DROP INDEX IF EXISTS idx_allowed_partners_phone;
DROP INDEX IF EXISTS idx_allowed_partners_type;

-- ============================================================
-- 5. DROP TABLE
-- ============================================================

DROP TABLE IF EXISTS public.allowed_partners CASCADE;

COMMIT;

