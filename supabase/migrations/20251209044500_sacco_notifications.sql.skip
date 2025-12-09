-- =====================================================
-- SACCO Notifications Table
-- User notifications for staff portal
-- =====================================================

BEGIN;

-- Notifications table
CREATE TABLE IF NOT EXISTS app.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID REFERENCES app.saccos(id),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON app.notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_sacco ON app.notifications(sacco_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON app.notifications(type, created_at DESC);

-- Enable RLS
ALTER TABLE app.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON app.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON app.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Service role full access to notifications" ON app.notifications
  FOR ALL USING (auth.role() = 'service_role');

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION app.mark_notification_read(notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE app.notifications
  SET read_at = NOW()
  WHERE id = notification_id AND user_id = auth.uid() AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION app.mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
  UPDATE app.notifications
  SET read_at = NOW()
  WHERE user_id = auth.uid() AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
