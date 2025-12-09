-- Migration: WhatsApp Auth + OTP User Model
-- Description: Creates the comprehensive user model for WhatsApp-based authentication
-- including user profiles, organizations, memberships, global roles, OTP tracking,
-- and device management.

BEGIN;

-- =====================================================
-- Ensure required extensions exist
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- Ensure app schema exists
-- =====================================================
CREATE SCHEMA IF NOT EXISTS app;

-- Grant access to PostgREST roles
GRANT USAGE ON SCHEMA app TO anon, authenticated, service_role;

-- =====================================================
-- Table: app.user_profiles
-- Extended user profile information linked to auth.users
-- =====================================================
CREATE TABLE IF NOT EXISTS app.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  display_name TEXT,
  primary_phone TEXT,
  whatsapp_phone TEXT,
  country_code TEXT DEFAULT 'RW',
  default_locale TEXT DEFAULT 'en-RW',
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.user_profiles IS 'Extended profile information for all users (admins, vendors, public clients)';
COMMENT ON COLUMN app.user_profiles.whatsapp_phone IS 'WhatsApp phone number in E.164 format for authentication flows';
COMMENT ON COLUMN app.user_profiles.primary_phone IS 'Primary contact phone number (may differ from WhatsApp)';

-- =====================================================
-- Enum: app_org_type
-- Types of organizations in the platform
-- =====================================================
DO $$ BEGIN
  CREATE TYPE app_org_type AS ENUM (
    'platform',
    'sacco',
    'mfi',
    'fi',
    'bar',
    'restaurant',
    'real_estate_agency',
    'other_vendor'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Table: app.organizations
-- All organization types (vendors, SACCOs, bars, agencies)
-- =====================================================
CREATE TABLE IF NOT EXISTS app.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_type app_org_type NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  momo_short_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.organizations IS 'All organization types: SACCOs, MFIs, bars, real estate agencies, etc.';
COMMENT ON COLUMN app.organizations.org_type IS 'Type of organization for routing and permissions';
COMMENT ON COLUMN app.organizations.momo_short_name IS 'Short name for MoMo USSD integration (for SACCOs/MFIs)';
COMMENT ON COLUMN app.organizations.settings IS 'Organization-specific settings (branding, limits, etc.)';

-- =====================================================
-- Enum: app_org_role
-- Roles within an organization
-- =====================================================
DO $$ BEGIN
  CREATE TYPE app_org_role AS ENUM (
    'owner',
    'admin',
    'manager',
    'staff',
    'readonly'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Table: app.org_memberships
-- User ↔ Organization membership with roles
-- =====================================================
CREATE TABLE IF NOT EXISTS app.org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_org_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

COMMENT ON TABLE app.org_memberships IS 'User membership and roles within organizations';
COMMENT ON COLUMN app.org_memberships.role IS 'Role within the organization: owner, admin, manager, staff, readonly';
COMMENT ON COLUMN app.org_memberships.status IS 'Membership status: active, invited, suspended';

-- =====================================================
-- Enum: app_global_role
-- Platform-wide admin roles
-- =====================================================
DO $$ BEGIN
  CREATE TYPE app_global_role AS ENUM (
    'platform_super_admin',
    'platform_ops',
    'platform_support',
    'platform_auditor'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Table: app.global_roles
-- Platform admin roles (for Admin PWA access)
-- =====================================================
CREATE TABLE IF NOT EXISTS app.global_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_global_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.global_roles IS 'Platform-wide admin roles for Admin PWA access';
COMMENT ON COLUMN app.global_roles.role IS 'Global role: super_admin, ops, support, auditor';

-- =====================================================
-- Enum: otp_purpose
-- Purpose of the OTP
-- =====================================================
DO $$ BEGIN
  CREATE TYPE otp_purpose AS ENUM (
    'login',
    'transaction',
    'device_link',
    'phone_change',
    'sensitive_action'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Table: app.whatsapp_otps
-- OTP tracking for WhatsApp authentication
-- =====================================================
CREATE TABLE IF NOT EXISTS app.whatsapp_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose otp_purpose NOT NULL DEFAULT 'login',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.whatsapp_otps IS 'Short-lived OTP records for WhatsApp authentication';
COMMENT ON COLUMN app.whatsapp_otps.phone_number IS 'Phone number in E.164 format';
COMMENT ON COLUMN app.whatsapp_otps.code_hash IS 'SHA-256 hash of the OTP code (never store plain text)';
COMMENT ON COLUMN app.whatsapp_otps.purpose IS 'Purpose: login, transaction, device_link, phone_change';
COMMENT ON COLUMN app.whatsapp_otps.attempt_count IS 'Number of verification attempts (rate limiting)';

-- =====================================================
-- Table: app.user_devices
-- Mobile device tracking for user sessions
-- =====================================================
CREATE TABLE IF NOT EXISTS app.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('android', 'ios', 'web')),
  push_token TEXT,
  device_name TEXT,
  app_version TEXT,
  os_version TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

COMMENT ON TABLE app.user_devices IS 'User mobile devices for session management and push notifications';
COMMENT ON COLUMN app.user_devices.device_id IS 'Unique device identifier (Android ID / iOS UUID)';
COMMENT ON COLUMN app.user_devices.push_token IS 'Firebase/APNs push notification token';

-- =====================================================
-- Table: app.org_devices
-- Organization-linked devices (MomoTerminal)
-- =====================================================
CREATE TABLE IF NOT EXISTS app.org_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  phone_number TEXT,
  sim_serial TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, device_id)
);

COMMENT ON TABLE app.org_devices IS 'Organization-linked devices for MomoTerminal SMS processing';
COMMENT ON COLUMN app.org_devices.phone_number IS 'SIM phone number used for MoMo SMS';
COMMENT ON COLUMN app.org_devices.sim_serial IS 'SIM card serial number for tracking';

-- =====================================================
-- Indexes
-- =====================================================

-- user_profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_whatsapp_phone 
  ON app.user_profiles(whatsapp_phone) 
  WHERE whatsapp_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_primary_phone 
  ON app.user_profiles(primary_phone) 
  WHERE primary_phone IS NOT NULL;

-- organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_org_type ON app.organizations(org_type);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON app.organizations(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON app.organizations(is_active);

-- org_memberships indexes
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON app.org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON app.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_status ON app.org_memberships(status);
CREATE INDEX IF NOT EXISTS idx_org_memberships_role ON app.org_memberships(role);

-- whatsapp_otps indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_otps_phone_number ON app.whatsapp_otps(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_otps_expires_at ON app.whatsapp_otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_otps_created_at ON app.whatsapp_otps(created_at DESC);

-- user_devices indexes
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON app.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON app.user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_active ON app.user_devices(last_active_at DESC);

-- org_devices indexes
CREATE INDEX IF NOT EXISTS idx_org_devices_org_id ON app.org_devices(org_id);
CREATE INDEX IF NOT EXISTS idx_org_devices_user_id ON app.org_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_org_devices_phone_number ON app.org_devices(phone_number) WHERE phone_number IS NOT NULL;

-- =====================================================
-- Updated_at trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER set_user_profiles_updated_at
    BEFORE UPDATE ON app.user_profiles
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_organizations_updated_at
    BEFORE UPDATE ON app.organizations
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_org_memberships_updated_at
    BEFORE UPDATE ON app.org_memberships
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Row Level Security
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE app.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.global_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.whatsapp_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.org_devices ENABLE ROW LEVEL SECURITY;

-- Service role has full access to all tables
CREATE POLICY service_role_user_profiles ON app.user_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_organizations ON app.organizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_org_memberships ON app.org_memberships
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_global_roles ON app.global_roles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_whatsapp_otps ON app.whatsapp_otps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_user_devices ON app.user_devices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY service_role_org_devices ON app.org_devices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- User Profile Policies
-- Users can read/update their own profile
-- =====================================================
CREATE POLICY users_read_own_profile ON app.user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY users_update_own_profile ON app.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- Organization Policies
-- Only admins can see all orgs; org members can see their own orgs
-- =====================================================
CREATE POLICY admins_read_all_organizations ON app.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.global_roles gr
      WHERE gr.user_id = auth.uid()
    )
  );

CREATE POLICY members_read_own_organizations ON app.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = app.organizations.id
        AND m.status = 'active'
    )
  );

-- =====================================================
-- Org Membership Policies
-- Users can see their own memberships; org admins can manage members
-- =====================================================
CREATE POLICY users_read_own_memberships ON app.org_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY org_admins_read_org_memberships ON app.org_memberships
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = app.org_memberships.org_id
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY org_admins_manage_org_memberships ON app.org_memberships
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = app.org_memberships.org_id
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = app.org_memberships.org_id
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- Global Roles Policies
-- Only super admins can see/manage global roles
-- =====================================================
CREATE POLICY super_admins_read_global_roles ON app.global_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.global_roles gr
      WHERE gr.user_id = auth.uid()
        AND gr.role = 'platform_super_admin'
    )
    OR user_id = auth.uid()
  );

-- =====================================================
-- User Devices Policies
-- Users can manage their own devices
-- =====================================================
CREATE POLICY users_manage_own_devices ON app.user_devices
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- Org Devices Policies
-- Org staff can see org devices; org admins can manage them
-- =====================================================
CREATE POLICY org_staff_read_org_devices ON app.org_devices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = app.org_devices.org_id
        AND m.status = 'active'
    )
  );

CREATE POLICY org_admins_manage_org_devices ON app.org_devices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = app.org_devices.org_id
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.org_memberships m
      WHERE m.user_id = auth.uid()
        AND m.org_id = app.org_devices.org_id
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin', 'manager')
    )
  );

-- =====================================================
-- Grant table access
-- =====================================================
GRANT ALL ON ALL TABLES IN SCHEMA app TO service_role;
GRANT SELECT, INSERT, UPDATE ON app.user_profiles TO authenticated;
GRANT SELECT ON app.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.org_memberships TO authenticated;
GRANT SELECT ON app.global_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.user_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.org_devices TO authenticated;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO authenticated;

COMMIT;
