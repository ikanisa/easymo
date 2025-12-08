-- Create ride_notifications table for driver notification tracking
-- This table is referenced in wa-webhook-mobility handlers but was missing

BEGIN;

-- Create ride_notifications table
CREATE TABLE IF NOT EXISTS public.ride_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'expired', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  response text CHECK (response IN ('accepted', 'rejected', 'ignored')),
  responded_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Add comment
COMMENT ON TABLE public.ride_notifications IS 'Tracks ride request notifications sent to drivers';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ride_notifications_trip_id ON public.ride_notifications(trip_id);
CREATE INDEX IF NOT EXISTS idx_ride_notifications_driver_id ON public.ride_notifications(driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_notifications_driver_created ON public.ride_notifications(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_notifications_status ON public.ride_notifications(status) WHERE status = 'sent';

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_ride_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ride_notifications_updated_at ON public.ride_notifications;
DROP TRIGGER IF EXISTS trg_ride_notifications_updated_at ON ; -- FIXME: add table name
CREATE TRIGGER trg_ride_notifications_updated_at
  BEFORE UPDATE ON public.ride_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_ride_notifications_updated_at();

-- Enable RLS
ALTER TABLE public.ride_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role policy using proper TO clause (Supabase recommended pattern)
DROP POLICY IF EXISTS "Service role full access" ON public.ride_notifications;
DROP POLICY IF EXISTS "Service role full access" ON public.ride_notifications;
CREATE POLICY "Service role full access"
  ON public.ride_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Drivers can view their own notifications
DROP POLICY IF EXISTS "Drivers can view own notifications" ON public.ride_notifications;
DROP POLICY IF EXISTS "Drivers can view own notifications" ON public.ride_notifications;
CREATE POLICY "Drivers can view own notifications"
  ON public.ride_notifications
  FOR SELECT
  USING (auth.uid() = driver_id);

-- Drivers can update their own notifications (to mark as read/respond)
DROP POLICY IF EXISTS "Drivers can update own notifications" ON public.ride_notifications;
DROP POLICY IF EXISTS "Drivers can update own notifications" ON public.ride_notifications;
CREATE POLICY "Drivers can update own notifications"
  ON public.ride_notifications
  FOR UPDATE
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.ride_notifications TO service_role;
GRANT SELECT, UPDATE ON public.ride_notifications TO authenticated;

-- Create function to record driver response to notification
CREATE OR REPLACE FUNCTION public.record_driver_notification_response(
  _notification_id uuid,
  _response text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ride_notifications
  SET 
    response = _response,
    responded_at = now(),
    -- Keep status as 'sent' if already delivered, otherwise mark as acknowledged
    status = CASE 
      WHEN _response IN ('accepted', 'rejected') THEN 'read'
      ELSE status
    END
  WHERE id = _notification_id
    AND driver_id = auth.uid();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or not authorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_driver_notification_response TO authenticated;

-- Create cleanup function for old notifications (to be scheduled via cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_ride_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete notifications older than 7 days
  WITH deleted AS (
    DELETE FROM public.ride_notifications
    WHERE created_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_ride_notifications TO service_role;

COMMIT;
