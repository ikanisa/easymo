-- Push tokens for Expo Push Notifications (Supabase-only, no Firebase)
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

-- RLS Policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can insert/update their own tokens
CREATE POLICY "Users can manage their own push tokens"
ON push_tokens
FOR ALL
USING (auth.uid() = user_id);

-- Service role can read all tokens (for sending notifications)
CREATE POLICY "Service role can read all tokens"
ON push_tokens
FOR SELECT
USING (auth.role() = 'service_role');

-- Cleanup old tokens (7 days inactive)
CREATE OR REPLACE FUNCTION cleanup_old_push_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM push_tokens
  WHERE updated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE push_tokens IS 'Expo push notification tokens for client mobile app (Supabase-only, no Firebase)';
