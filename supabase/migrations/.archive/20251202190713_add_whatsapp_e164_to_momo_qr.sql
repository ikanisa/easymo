BEGIN;

-- Add whatsapp_e164 column to momo_qr_requests table
-- This column stores the E.164 formatted WhatsApp number of the requester
ALTER TABLE public.momo_qr_requests 
  ADD COLUMN IF NOT EXISTS whatsapp_e164 TEXT;

-- Add index for performance on lookups by whatsapp number
CREATE INDEX IF NOT EXISTS idx_momo_qr_requests_whatsapp_e164 
  ON public.momo_qr_requests(whatsapp_e164);

-- Add index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_momo_qr_requests_created_at 
  ON public.momo_qr_requests(created_at DESC);

COMMIT;
