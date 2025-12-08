-- Add Insurance Admin Notifications Infrastructure
BEGIN;

-- Create notifications table (generic notifications queue)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_wa_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status) 
  WHERE status IN ('queued', 'failed');
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_to_wa ON public.notifications(to_wa_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- Create insurance_admin_notifications table (audit trail for insurance admin alerts)
CREATE TABLE IF NOT EXISTS public.insurance_admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
  admin_wa_id TEXT NOT NULL,
  user_wa_id TEXT NOT NULL,
  notification_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_lead ON public.insurance_admin_notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_status ON public.insurance_admin_notifications(status);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'insurance_admin_notifications' AND column_name = 'admin_wa_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_admin ON public.insurance_admin_notifications(admin_wa_id);
  ELSE
    RAISE NOTICE 'Skipping idx_insurance_admin_notifications_admin because admin_wa_id is missing.';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_created ON public.insurance_admin_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_admin_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications (service role only)
DROP POLICY IF EXISTS notifications_service_all ON public.notifications;
CREATE POLICY notifications_service_all ON public.notifications
  FOR ALL USING (auth.role() = 'service_role');

-- RLS policies for insurance_admin_notifications (service role only)
DROP POLICY IF EXISTS insurance_admin_notifications_service_all ON public.insurance_admin_notifications;
CREATE POLICY insurance_admin_notifications_service_all ON public.insurance_admin_notifications
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.insurance_admin_notifications TO service_role;

COMMIT;
