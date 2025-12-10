-- Notification preferences for per-user toggles
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'WHATSAPP')),
  event_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id 
  ON public.notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_lookup
  ON public.notification_preferences(user_id, channel, event_type);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own preferences
CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- System admins can manage all preferences
CREATE POLICY "System admins can manage all notification preferences"
  ON public.notification_preferences FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

-- Add trigger for updated_at
CREATE TRIGGER notification_preferences_set_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Add sacco_id and template_id to notification_queue if not exists
-- Note: saccos is in app schema, not public
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'saccos') THEN
    EXECUTE 'ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS sacco_id UUID REFERENCES app.saccos(id) ON DELETE SET NULL';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saccos') THEN
    EXECUTE 'ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS sacco_id UUID REFERENCES public.saccos(id) ON DELETE SET NULL';
  ELSE
    -- Add column without FK constraint if table doesn't exist yet
    EXECUTE 'ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS sacco_id UUID';
  END IF;
  
  -- Always add template_id (sms_templates is in public schema)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_queue' AND column_name = 'template_id') THEN
    EXECUTE 'ALTER TABLE public.notification_queue ADD COLUMN template_id UUID REFERENCES public.sms_templates(id) ON DELETE SET NULL';
  END IF;
END $$;

-- Create index for notification queue lookups
CREATE INDEX IF NOT EXISTS idx_notification_queue_event 
  ON public.notification_queue(event);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_scheduled
  ON public.notification_queue(status, scheduled_for) WHERE status = 'PENDING';

-- Add tokens column to sms_templates if not exists (for template variables)
ALTER TABLE public.sms_templates
  ADD COLUMN IF NOT EXISTS tokens JSONB DEFAULT '[]'::jsonb;

-- Helper function to check if user has notification enabled
CREATE OR REPLACE FUNCTION public.is_notification_enabled(
  p_user_id UUID,
  p_channel TEXT,
  p_event_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO v_enabled
  FROM public.notification_preferences
  WHERE user_id = p_user_id
    AND channel = p_channel
    AND event_type = p_event_type;
  
  -- If no preference exists, default to enabled
  RETURN COALESCE(v_enabled, TRUE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper function to enqueue notification
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_event TEXT,
  p_channel TEXT,
  p_sacco_id UUID DEFAULT NULL,
  p_template_id UUID DEFAULT NULL,
  p_payment_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO public.notification_queue (
    event,
    channel,
    sacco_id,
    template_id,
    payment_id,
    payload,
    scheduled_for,
    status
  ) VALUES (
    p_event,
    p_channel::public.notification_channel,
    p_sacco_id,
    p_template_id,
    p_payment_id,
    p_payload,
    p_scheduled_for,
    'PENDING'
  )
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_notification_enabled(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(TEXT, TEXT, UUID, UUID, UUID, JSONB, TIMESTAMPTZ) TO authenticated;
