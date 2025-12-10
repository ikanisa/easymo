-- Add missing RLS policies for tables that were missing them
-- Issue: Tables without RLS enabled or policies

-- Enable RLS for notification_templates
-- This table stores notification templates, should be readable by authenticated users
-- but only writable by service role
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_templates_read" ON public.notification_templates
  FOR SELECT
  TO authenticated
  USING (
    -- Users can read templates for their SACCO or global templates
    sacco_id IS NULL OR EXISTS (
      SELECT 1 FROM public.org_memberships om
      JOIN public.organizations o ON om.org_id = o.id
      JOIN public.saccos s ON s.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND s.id = notification_templates.sacco_id
    )
  );

CREATE POLICY "notification_templates_write_service" ON public.notification_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS for rate_limit_counters
-- This is a system table, should only be accessible to service role
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_counters_service_only" ON public.rate_limit_counters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS for sms_templates
-- SMS templates should be readable by staff of the SACCO
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_templates_read" ON public.sms_templates
  FOR SELECT
  TO authenticated
  USING (
    -- Users can read templates for SACCOs they belong to
    EXISTS (
      SELECT 1 FROM public.org_memberships om
      JOIN public.organizations o ON om.org_id = o.id
      JOIN public.saccos s ON s.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND s.id = sms_templates.sacco_id
    )
  );

CREATE POLICY "sms_templates_write" ON public.sms_templates
  FOR ALL
  TO authenticated
  USING (
    -- Staff and above can manage templates
    EXISTS (
      SELECT 1 FROM public.org_memberships om
      JOIN public.organizations o ON om.org_id = o.id
      JOIN public.saccos s ON s.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND s.id = sms_templates.sacco_id
        AND om.role IN ('STAFF', 'MANAGER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships om
      JOIN public.organizations o ON om.org_id = o.id
      JOIN public.saccos s ON s.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND s.id = sms_templates.sacco_id
        AND om.role IN ('STAFF', 'MANAGER', 'ADMIN')
    )
  );

-- Enable RLS for user_notification_preferences
-- Users can only read/write their own preferences
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_notification_preferences_own" ON public.user_notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Also allow service role full access for system operations
CREATE POLICY "user_notification_preferences_service" ON public.user_notification_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE public.notification_templates IS 'Notification templates for event-driven notifications. RLS enforced.';
COMMENT ON TABLE public.rate_limit_counters IS 'System rate limiting counters. Service role only.';
COMMENT ON TABLE public.sms_templates IS 'SMS message templates scoped to SACCOs. RLS enforced.';
COMMENT ON TABLE public.user_notification_preferences IS 'User notification channel preferences. Users can only access their own.';
