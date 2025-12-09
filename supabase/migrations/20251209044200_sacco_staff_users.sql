-- =====================================================
-- SACCO Staff Users Table
-- Staff users for vendor portal with role-based access
-- =====================================================

BEGIN;

-- Create app schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- Create saccos table first (if not exists)
CREATE TABLE IF NOT EXISTS app.saccos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  registration_number TEXT,
  settings JSONB DEFAULT '{}',
  webhook_url TEXT,
  webhook_secret TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on sacco code
CREATE INDEX IF NOT EXISTS idx_saccos_code ON app.saccos(code);

-- Staff users table for vendor portal
CREATE TABLE IF NOT EXISTS app.staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff', 'viewer')),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  permissions JSONB DEFAULT '{}',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sacco_id)
);

-- Indexes for staff_users
CREATE INDEX IF NOT EXISTS idx_staff_users_sacco ON app.staff_users(sacco_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_user ON app.staff_users(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_email ON app.staff_users(email);

-- Enable RLS
ALTER TABLE app.saccos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.staff_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saccos
CREATE POLICY "Staff can view own SACCO" ON app.saccos
  FOR SELECT USING (
    id IN (
      SELECT sacco_id FROM app.staff_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to saccos" ON app.saccos
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for staff_users
CREATE POLICY "Staff can view own SACCO staff" ON app.staff_users
  FOR SELECT USING (
    sacco_id IN (
      SELECT sacco_id FROM app.staff_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage staff" ON app.staff_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM app.staff_users AS su
      WHERE su.user_id = auth.uid() 
      AND su.sacco_id = staff_users.sacco_id 
      AND su.role = 'admin'
    )
  );

CREATE POLICY "Service role full access to staff" ON app.staff_users
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saccos_updated_at ON app.saccos;
CREATE TRIGGER update_saccos_updated_at
  BEFORE UPDATE ON app.saccos
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_users_updated_at ON app.staff_users;
CREATE TRIGGER update_staff_users_updated_at
  BEFORE UPDATE ON app.staff_users
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_at_column();

COMMIT;
