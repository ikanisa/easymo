-- =====================================================================
-- INTENT NOTIFICATIONS OPT-OUT & TIME WINDOW
-- =====================================================================
-- Add opt-out tracking and enforce time window for intent matching
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. CREATE OPT-OUT TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.intent_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  
  -- Opt-out settings
  notifications_enabled BOOLEAN DEFAULT true,
  opted_out_at TIMESTAMPTZ,
  opted_out_reason TEXT,
  
  -- Re-subscription
  can_resubscribe BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_phone ON public.intent_notification_preferences(phone_number);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_enabled ON public.intent_notification_preferences(notifications_enabled);

-- Auto-update timestamp
DROP TRIGGER IF EXISTS update_notification_prefs_updated_at ON public.intent_notification_preferences;
DROP TRIGGER IF EXISTS update_notification_prefs_updated_at ON ; -- FIXME: add table name
CREATE TRIGGER update_notification_prefs_updated_at
  BEFORE UPDATE ON public.intent_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2. RLS POLICIES
-- =====================================================================

ALTER TABLE public.intent_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DROP POLICY IF EXISTS "Service role has full access to notification preferences" ON public.intent_notification_preferences;
DROP POLICY IF EXISTS "Service role has full access to notification preferences" ON public.intent_notification_preferences;
CREATE POLICY "Service role has full access to notification preferences"
  ON public.intent_notification_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view and update their own preferences
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.intent_notification_preferences;
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.intent_notification_preferences;
CREATE POLICY "Users can view their own notification preferences"
  ON public.intent_notification_preferences
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.intent_notification_preferences;
DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.intent_notification_preferences;
CREATE POLICY "Users can update their own notification preferences"
  ON public.intent_notification_preferences
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- =====================================================================
-- 3. HELPER FUNCTION - CHECK IF USER HAS NOTIFICATIONS ENABLED
-- =====================================================================

CREATE OR REPLACE FUNCTION public.user_has_notifications_enabled(p_phone_number TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT notifications_enabled 
      FROM public.intent_notification_preferences 
      WHERE phone_number = p_phone_number
    ),
    true  -- Default to enabled if no preference exists
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 4. HELPER FUNCTION - OPT OUT USER
-- =====================================================================

CREATE OR REPLACE FUNCTION public.opt_out_intent_notifications(
  p_phone_number TEXT,
  p_reason TEXT DEFAULT 'User requested'
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  INSERT INTO public.intent_notification_preferences (
    phone_number,
    notifications_enabled,
    opted_out_at,
    opted_out_reason
  ) VALUES (
    p_phone_number,
    false,
    now(),
    p_reason
  )
  ON CONFLICT (phone_number) 
  DO UPDATE SET
    notifications_enabled = false,
    opted_out_at = now(),
    opted_out_reason = p_reason,
    updated_at = now();
  
  -- Also cancel pending intents for this user
  UPDATE public.user_intents
  SET status = 'cancelled'
  WHERE phone_number = p_phone_number
    AND status IN ('pending_match', 'matching');
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'You will no longer receive match notifications. Reply SUBSCRIBE to opt back in.',
    'opted_out_at', now()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 5. HELPER FUNCTION - OPT IN USER
-- =====================================================================

CREATE OR REPLACE FUNCTION public.opt_in_intent_notifications(p_phone_number TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  INSERT INTO public.intent_notification_preferences (
    phone_number,
    notifications_enabled
  ) VALUES (
    p_phone_number,
    true
  )
  ON CONFLICT (phone_number) 
  DO UPDATE SET
    notifications_enabled = true,
    updated_at = now();
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'You are now subscribed to match notifications.',
    'opted_in_at', now()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 6. UPDATE INTENT MATCHING WINDOW (24 HOURS)
-- =====================================================================

-- Add comment to document time window requirement
COMMENT ON TABLE public.user_intents IS 'User intents are processed within 24 hours of creation. Intents older than 24 hours are automatically expired.';

-- Function to expire old intents (called by cron)
CREATE OR REPLACE FUNCTION public.expire_old_intents()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Expire intents older than 24 hours that are still pending
  UPDATE public.user_intents
  SET status = 'expired'
  WHERE status IN ('pending_match', 'matching')
    AND created_at < (now() - interval '24 hours');
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule expiration check (runs every hour)
SELECT cron.schedule(
  'expire-old-intents-hourly',
  '0 * * * *',  -- Every hour at minute 0
  $$
  SELECT public.expire_old_intents();
  $$
);

COMMIT;
