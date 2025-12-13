BEGIN;

-- Migration: Remove Profile Menu Items Table and Related Functions
-- Purpose: Simplify profile system by hard-coding menu items instead of database-driven approach
-- Date: 2025-12-13
-- Related to: Profile Microservice Refactor

-- Drop the RPC function for fetching dynamic profile menu items
DROP FUNCTION IF EXISTS public.get_profile_menu_items_v2(UUID, TEXT, TEXT) CASCADE;

-- Drop the profile menu items table
DROP TABLE IF EXISTS public.profile_menu_items CASCADE;

-- Note: We keep the following tables that are still needed:
-- - profiles: User profile data
-- - saved_locations: User's favorite locations
-- - wallet_accounts: Wallet balances
-- - wallet_transactions: Wallet transaction history

COMMIT;
