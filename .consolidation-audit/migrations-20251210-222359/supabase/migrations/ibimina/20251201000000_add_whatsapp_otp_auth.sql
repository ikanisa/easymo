-- Migration: Add WhatsApp OTP authentication for client app members
-- Description: Tables and functions for WhatsApp-based OTP authentication
-- Date: 2025-12-01

-- Create table for WhatsApp OTP codes
CREATE TABLE IF NOT EXISTS app.whatsapp_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  
  -- Prevent multiple active codes for same phone
  CONSTRAINT unique_active_otp 
    UNIQUE NULLS NOT DISTINCT (phone_number, consumed_at)
    WHERE consumed_at IS NULL
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_phone ON app.whatsapp_otp_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_expires ON app.whatsapp_otp_codes(expires_at);

-- Enable RLS
ALTER TABLE app.whatsapp_otp_codes ENABLE ROW LEVEL SECURITY;

-- Service role can manage OTP codes
CREATE POLICY "Service role can manage OTP codes"
  ON app.whatsapp_otp_codes
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Add authentication fields to members_app_profiles
DO $$
BEGIN
  -- Add WhatsApp verification fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'whatsapp_verified'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN whatsapp_verified BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'whatsapp_verified_at'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN whatsapp_verified_at TIMESTAMPTZ;
  END IF;

  -- Add biometric authentication fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'biometric_enabled'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN biometric_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'biometric_enrolled_at'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN biometric_enrolled_at TIMESTAMPTZ;
  END IF;

  -- Add last login timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create permission types enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_permission') THEN
    CREATE TYPE public.member_permission AS ENUM (
      'VIEW_BALANCE',
      'VIEW_TRANSACTIONS',
      'MAKE_PAYMENTS',
      'VIEW_GROUPS',
      'JOIN_GROUPS',
      'MANAGE_PROFILE'
    );
  END IF;
END $$;

-- Create member permissions table
CREATE TABLE IF NOT EXISTS public.member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.member_permission NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  
  -- Unique constraint to prevent duplicate permissions
  UNIQUE (user_id, permission)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_member_permissions_user ON public.member_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_member_permissions_permission ON public.member_permissions(permission);

-- Enable RLS
ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;

-- Members can view their own permissions
CREATE POLICY "Members can view own permissions"
  ON public.member_permissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage permissions
CREATE POLICY "Service role can manage permissions"
  ON public.member_permissions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Staff can manage member permissions
CREATE POLICY "Staff can manage member permissions"
  ON public.member_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('SYSTEM_ADMIN', 'SACCO_MANAGER', 'SACCO_STAFF')
    )
  );

-- Create function to check if user has permission
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _permission public.member_permission
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.member_permissions
    WHERE user_id = _user_id
      AND permission = _permission
      AND (expires_at IS NULL OR expires_at > timezone('UTC', now()))
  );
END;
$$;

-- Grant default permissions to new members
CREATE OR REPLACE FUNCTION public.grant_default_member_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Grant basic permissions to new members
  INSERT INTO public.member_permissions (user_id, permission)
  VALUES 
    (NEW.user_id, 'VIEW_BALANCE'),
    (NEW.user_id, 'VIEW_TRANSACTIONS'),
    (NEW.user_id, 'VIEW_GROUPS'),
    (NEW.user_id, 'MANAGE_PROFILE')
  ON CONFLICT (user_id, permission) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to grant default permissions on profile creation
DROP TRIGGER IF EXISTS grant_default_permissions_on_profile ON public.members_app_profiles;
CREATE TRIGGER grant_default_permissions_on_profile
  AFTER INSERT ON public.members_app_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_default_member_permissions();

-- Add cleanup function for expired OTP codes
CREATE OR REPLACE FUNCTION app.cleanup_expired_otp_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app
AS $$
BEGIN
  DELETE FROM app.whatsapp_otp_codes
  WHERE expires_at < timezone('UTC', now()) - interval '1 day';
END;
$$;

-- Create scheduled job to cleanup expired OTP codes (runs daily at 2 AM)
DO $$
BEGIN
  -- Only create cron job if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-expired-otp-codes',
      '0 2 * * *',
      'SELECT app.cleanup_expired_otp_codes()'
    );
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON app.whatsapp_otp_codes TO authenticated;
GRANT ALL ON public.member_permissions TO authenticated;

-- Comments
COMMENT ON TABLE app.whatsapp_otp_codes IS 'WhatsApp OTP codes for member authentication';
COMMENT ON TABLE public.member_permissions IS 'Member permissions for granular access control';
COMMENT ON COLUMN public.members_app_profiles.whatsapp_verified IS 'Whether WhatsApp number has been verified via OTP';
COMMENT ON COLUMN public.members_app_profiles.biometric_enabled IS 'Whether biometric authentication is enabled for this user';
COMMENT ON FUNCTION public.has_permission IS 'Check if a user has a specific permission';
