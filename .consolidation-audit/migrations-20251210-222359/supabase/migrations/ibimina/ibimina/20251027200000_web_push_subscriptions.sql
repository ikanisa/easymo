-- Web Push Subscriptions
-- Stores user push subscription endpoints for web push notifications with topic-based subscriptions

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  -- Topics this subscription is interested in (e.g., ["all", "sacco:uuid", "ikimina:uuid"])
  topics JSONB NOT NULL DEFAULT '["all"]'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_user_id ON public.user_push_subscriptions(user_id);

-- Index for topic-based queries (GIN index for JSONB array containment)
CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_topics ON public.user_push_subscriptions USING GIN(topics);

-- Enable RLS
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY user_push_subscriptions_owner_policy
  ON public.user_push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System admins can view all subscriptions
CREATE POLICY user_push_subscriptions_admin_policy
  ON public.user_push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'SYSTEM_ADMIN'
    )
  );

COMMENT ON TABLE public.user_push_subscriptions IS 'Web Push subscription endpoints with topic-based filtering for user notifications';
COMMENT ON COLUMN public.user_push_subscriptions.topics IS 'JSON array of topic strings for filtering notifications (e.g., ["all", "sacco:uuid", "ikimina:uuid"])';
