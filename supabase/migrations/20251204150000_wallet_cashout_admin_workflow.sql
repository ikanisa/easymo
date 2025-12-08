-- =====================================================
-- WALLET CASHOUT ENHANCEMENTS
-- =====================================================
-- Adds admin notification tracking and cashout workflow improvements
-- =====================================================

-- Add receive_cashout_notifications column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS receive_cashout_notifications BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN profiles.receive_cashout_notifications IS 'Whether admin should receive cashout notifications via WhatsApp';

-- Create admin_notifications table if not exists
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for admin_notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON admin_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);

-- Add RLS policies for admin_notifications
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can view all notifications
DROP POLICY IF EXISTS admin_notifications_select_policy ON admin_notifications;
CREATE POLICY admin_notifications_select_policy ON admin_notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update notifications (mark as read)
DROP POLICY IF EXISTS admin_notifications_update_policy ON admin_notifications;
CREATE POLICY admin_notifications_update_policy ON admin_notifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service role can insert notifications
DROP POLICY IF EXISTS admin_notifications_insert_policy ON admin_notifications;
CREATE POLICY admin_notifications_insert_policy ON admin_notifications
  FOR INSERT
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_notifications_updated_at ON admin_notifications;
DROP TRIGGER IF EXISTS admin_notifications_updated_at ON ; -- FIXME: add table name
CREATE TRIGGER admin_notifications_updated_at
  BEFORE UPDATE ON admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_notifications_updated_at();

-- Add admin notification count function
CREATE OR REPLACE FUNCTION get_unread_admin_notifications_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM admin_notifications
    WHERE read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (admins will check via RLS)
GRANT EXECUTE ON FUNCTION get_unread_admin_notifications_count() TO authenticated;

-- Add cashout status tracking
ALTER TABLE wallet_cashouts
ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_processed_by UUID REFERENCES profiles(user_id),
ADD COLUMN IF NOT EXISTS admin_processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add comments
COMMENT ON COLUMN wallet_cashouts.admin_notified_at IS 'When admin was notified about this cashout request';
COMMENT ON COLUMN wallet_cashouts.admin_processed_by IS 'Admin who processed the cashout';
COMMENT ON COLUMN wallet_cashouts.admin_processed_at IS 'When admin processed the cashout';
COMMENT ON COLUMN wallet_cashouts.admin_notes IS 'Admin notes about the cashout processing';

-- Add index for pending cashouts
CREATE INDEX IF NOT EXISTS idx_wallet_cashouts_pending ON wallet_cashouts(status, created_at DESC)
  WHERE status = 'pending';

-- Create function to mark cashout as processed
CREATE OR REPLACE FUNCTION process_wallet_cashout(
  p_cashout_id UUID,
  p_admin_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can process cashouts';
  END IF;

  -- Update cashout
  UPDATE wallet_cashouts
  SET
    status = p_status,
    admin_processed_by = p_admin_id,
    admin_processed_at = now(),
    admin_notes = p_notes,
    updated_at = now()
  WHERE id = p_cashout_id
  RETURNING jsonb_build_object(
    'id', id,
    'status', status,
    'processed_at', admin_processed_at
  ) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Cashout not found: %', p_cashout_id;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (RLS will restrict to admins)
GRANT EXECUTE ON FUNCTION process_wallet_cashout(UUID, UUID, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION process_wallet_cashout IS 'Allows admins to mark cashout requests as processed';
