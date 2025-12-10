-- Migration: Remove MFA System
-- This migration removes all MFA-related tables, columns, and functions
-- to simplify authentication to Supabase native email/password only

-- Drop MFA-related tables (CASCADE will handle associated triggers)
DROP TABLE IF EXISTS public.trusted_devices CASCADE;
DROP TABLE IF EXISTS public.webauthn_credentials CASCADE;
DROP TABLE IF EXISTS public.mfa_recovery_codes CASCADE;
DROP TABLE IF EXISTS app.mfa_email_codes CASCADE;
DROP TABLE IF EXISTS app.mfa_codes CASCADE;

-- Remove MFA columns from users table
ALTER TABLE public.users 
  DROP COLUMN IF EXISTS mfa_enabled,
  DROP COLUMN IF EXISTS mfa_secret_enc,
  DROP COLUMN IF EXISTS mfa_enrolled_at,
  DROP COLUMN IF EXISTS mfa_methods,
  DROP COLUMN IF EXISTS mfa_backup_hashes,
  DROP COLUMN IF EXISTS last_mfa_success_at,
  DROP COLUMN IF EXISTS failed_mfa_count,
  DROP COLUMN IF EXISTS last_mfa_step,
  DROP COLUMN IF EXISTS mfa_passkey_enrolled;

-- Drop MFA-related functions if they exist
DROP FUNCTION IF EXISTS public.touch_mfa_recovery_codes() CASCADE;
