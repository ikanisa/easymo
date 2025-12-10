BEGIN;

-- Add sent_at column to notifications table
-- This column is used by insurance admin notification system to track when notifications were sent
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Create index for efficient querying of sent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at 
ON public.notifications(sent_at) WHERE sent_at IS NOT NULL;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_notifications_status 
ON public.notifications(status, created_at DESC);

COMMIT;
