-- =====================================================
-- SACCO Members and Groups (Ikimina) Tables
-- Core tables for member and group savings management
-- =====================================================

BEGIN;

-- Create members table
CREATE TABLE IF NOT EXISTS app.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  national_id TEXT,
  account_number TEXT,
  account_type TEXT DEFAULT 'savings' CHECK (account_type IN ('savings', 'loan', 'shares')),
  balance NUMERIC(15, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sacco_id, phone),
  UNIQUE(sacco_id, national_id)
);

-- Create groups (Ikimina) table
CREATE TABLE IF NOT EXISTS app.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ASCA' CHECK (type IN ('ASCA', 'ROSCA')),
  contribution_amount NUMERIC(15, 2) NOT NULL,
  contribution_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (contribution_frequency IN ('daily', 'weekly', 'monthly')),
  meeting_day TEXT,
  payout_rotation JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sacco_id, code)
);

-- Create group_members junction table
CREATE TABLE IF NOT EXISTS app.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES app.groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES app.members(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contribution_status TEXT DEFAULT 'current' CHECK (contribution_status IN ('current', 'behind', 'ahead')),
  total_contributed NUMERIC(15, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  UNIQUE(group_id, member_id)
);

-- Create payments table
CREATE TABLE IF NOT EXISTS app.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  member_id UUID REFERENCES app.members(id) ON DELETE SET NULL,
  group_id UUID REFERENCES app.groups(id) ON DELETE SET NULL,
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  payment_method TEXT DEFAULT 'mobile_money',
  reference TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES auth.users(id),
  sms_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for members
CREATE INDEX IF NOT EXISTS idx_members_sacco ON app.members(sacco_id);
CREATE INDEX IF NOT EXISTS idx_members_phone ON app.members(phone);
CREATE INDEX IF NOT EXISTS idx_members_national_id ON app.members(national_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON app.members(sacco_id, status);

-- Indexes for groups
CREATE INDEX IF NOT EXISTS idx_groups_sacco ON app.groups(sacco_id);
CREATE INDEX IF NOT EXISTS idx_groups_code ON app.groups(code);
CREATE INDEX IF NOT EXISTS idx_groups_status ON app.groups(sacco_id, status);

-- Indexes for group_members
CREATE INDEX IF NOT EXISTS idx_group_members_group ON app.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_member ON app.group_members(member_id);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_sacco ON app.payments(sacco_id);
CREATE INDEX IF NOT EXISTS idx_payments_member ON app.payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_group ON app.payments(group_id);
CREATE INDEX IF NOT EXISTS idx_payments_phone ON app.payments(phone);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON app.payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON app.payments(sacco_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON app.payments(sacco_id, created_at DESC);

-- Enable RLS
ALTER TABLE app.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for members
CREATE POLICY "Staff can view own SACCO members" ON app.members
  FOR SELECT USING (
    sacco_id IN (
      SELECT sacco_id FROM app.staff_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage members" ON app.members
  FOR ALL USING (
    sacco_id IN (
      SELECT sacco_id FROM app.staff_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager', 'staff')
    )
  );

CREATE POLICY "Service role full access to members" ON app.members
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for groups
CREATE POLICY "Staff can view own SACCO groups" ON app.groups
  FOR SELECT USING (
    sacco_id IN (
      SELECT sacco_id FROM app.staff_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage groups" ON app.groups
  FOR ALL USING (
    sacco_id IN (
      SELECT sacco_id FROM app.staff_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager', 'staff')
    )
  );

CREATE POLICY "Service role full access to groups" ON app.groups
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for group_members
CREATE POLICY "Staff can view group members" ON app.group_members
  FOR SELECT USING (
    group_id IN (
      SELECT id FROM app.groups WHERE sacco_id IN (
        SELECT sacco_id FROM app.staff_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can manage group members" ON app.group_members
  FOR ALL USING (
    group_id IN (
      SELECT id FROM app.groups WHERE sacco_id IN (
        SELECT sacco_id FROM app.staff_users 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager', 'staff')
      )
    )
  );

CREATE POLICY "Service role full access to group_members" ON app.group_members
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for payments
CREATE POLICY "Staff can view own SACCO payments" ON app.payments
  FOR SELECT USING (
    sacco_id IN (
      SELECT sacco_id FROM app.staff_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage payments" ON app.payments
  FOR ALL USING (
    sacco_id IN (
      SELECT sacco_id FROM app.staff_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager', 'staff')
    )
  );

CREATE POLICY "Service role full access to payments" ON app.payments
  FOR ALL USING (auth.role() = 'service_role');

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_members_updated_at ON app.members;
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON app.members
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_at_column();

DROP TRIGGER IF EXISTS update_groups_updated_at ON app.groups;
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON app.groups
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON app.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON app.payments
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_at_column();

COMMIT;
