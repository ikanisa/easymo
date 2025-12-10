-- Analytics Event Logging
-- Extends the existing system_metrics table with structured event logging for business metrics

-- Add new event types to track join requests, approvals, and exception resolution
-- This migration enhances telemetry tracking for operational analytics

-- Create analytics_events table for detailed event tracking with timing metrics
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  -- Entity references (using UUID without foreign keys for flexibility)
  sacco_id UUID,
  ikimina_id UUID,
  user_id UUID,
  payment_id UUID,
  -- Event metadata and timing
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- For tracking time between related events (e.g., request created -> approved)
  related_event_id UUID,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_sacco_id ON public.analytics_events(sacco_id) WHERE sacco_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_ikimina_id ON public.analytics_events(ikimina_id) WHERE ikimina_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at ON public.analytics_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_related ON public.analytics_events(related_event_id) WHERE related_event_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Staff can view events for their assigned SACCO
CREATE POLICY analytics_events_staff_policy
  ON public.analytics_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (
          users.role = 'SYSTEM_ADMIN'
          OR users.sacco_id = analytics_events.sacco_id
        )
    )
  );

-- Service role can insert events
CREATE POLICY analytics_events_service_policy
  ON public.analytics_events
  FOR ALL
  USING (auth.uid() IS NULL OR auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.uid() IS NULL OR auth.jwt()->>'role' = 'service_role');

-- Helper function to log an analytics event
CREATE OR REPLACE FUNCTION public.log_analytics_event(
  p_event_type TEXT,
  p_sacco_id UUID DEFAULT NULL,
  p_ikimina_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_payment_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_related_event_id UUID DEFAULT NULL,
  p_duration_seconds INTEGER DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.analytics_events (
    event_type,
    sacco_id,
    ikimina_id,
    user_id,
    payment_id,
    metadata,
    related_event_id,
    duration_seconds,
    occurred_at
  ) VALUES (
    p_event_type,
    p_sacco_id,
    p_ikimina_id,
    p_user_id,
    p_payment_id,
    p_metadata,
    p_related_event_id,
    p_duration_seconds,
    NOW()
  ) RETURNING id INTO v_event_id;

  -- Also increment the system_metrics counter for backwards compatibility
  PERFORM public.increment_system_metric(p_event_type, 1, p_metadata);

  RETURN v_event_id;
END;
$$;

-- Helper function to calculate and log completion time for a workflow
CREATE OR REPLACE FUNCTION public.log_analytics_completion(
  p_event_type TEXT,
  p_initial_event_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_duration_seconds INTEGER;
  v_initial_occurred_at TIMESTAMPTZ;
BEGIN
  -- Get the initial event timestamp
  SELECT occurred_at INTO v_initial_occurred_at
  FROM public.analytics_events
  WHERE id = p_initial_event_id;

  IF v_initial_occurred_at IS NULL THEN
    RAISE EXCEPTION 'Initial event not found: %', p_initial_event_id;
  END IF;

  -- Calculate duration in seconds
  v_duration_seconds := EXTRACT(EPOCH FROM (NOW() - v_initial_occurred_at))::INTEGER;

  -- Insert completion event
  INSERT INTO public.analytics_events (
    event_type,
    sacco_id,
    ikimina_id,
    user_id,
    payment_id,
    metadata,
    related_event_id,
    duration_seconds,
    occurred_at
  )
  SELECT
    p_event_type,
    sacco_id,
    ikimina_id,
    user_id,
    payment_id,
    p_metadata || jsonb_build_object('duration_seconds', v_duration_seconds),
    p_initial_event_id,
    v_duration_seconds,
    NOW()
  FROM public.analytics_events
  WHERE id = p_initial_event_id
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Seed some initial event type metadata for documentation
INSERT INTO public.system_metrics (event, total, last_occurred, meta)
VALUES
  ('join_request_created', 0, NOW(), '{"description": "Member join request initiated"}'::jsonb),
  ('join_request_approved', 0, NOW(), '{"description": "Member join request approved", "tracks_duration": true}'::jsonb),
  ('join_request_rejected', 0, NOW(), '{"description": "Member join request rejected", "tracks_duration": true}'::jsonb),
  ('exception_created', 0, NOW(), '{"description": "Payment exception flagged for review"}'::jsonb),
  ('exception_resolved', 0, NOW(), '{"description": "Payment exception resolved", "tracks_duration": true}'::jsonb),
  ('exception_escalated', 0, NOW(), '{"description": "Payment exception escalated", "tracks_duration": true}'::jsonb)
ON CONFLICT (event) DO NOTHING;

COMMENT ON TABLE public.analytics_events IS 'Detailed event tracking for business metrics and operational analytics';
COMMENT ON COLUMN public.analytics_events.duration_seconds IS 'Time elapsed from related_event to this event, for workflow timing analytics';
COMMENT ON FUNCTION public.log_analytics_event IS 'Logs an analytics event with optional entity references and metadata';
COMMENT ON FUNCTION public.log_analytics_completion IS 'Logs a completion event with calculated duration from an initial event';
