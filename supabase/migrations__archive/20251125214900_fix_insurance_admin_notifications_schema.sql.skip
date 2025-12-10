BEGIN;

-- Add missing columns to insurance_admin_notifications table
ALTER TABLE public.insurance_admin_notifications 
ADD COLUMN IF NOT EXISTS sent_at timestamptz,
ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for efficient querying of failed notifications
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_status 
ON public.insurance_admin_notifications(status, created_at DESC);

-- Create index for lead_id lookups
CREATE INDEX IF NOT EXISTS idx_insurance_admin_notifications_lead_id 
ON public.insurance_admin_notifications(lead_id);

-- Grant permissions
GRANT ALL ON public.insurance_admin_notifications TO service_role;

COMMIT;
