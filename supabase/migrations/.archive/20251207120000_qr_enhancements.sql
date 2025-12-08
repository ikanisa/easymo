-- QR Code System Enhancements
-- Adds missing columns for QR image storage, analytics, and WhatsApp deep links
BEGIN;

-- Add missing columns to qr_tokens table
ALTER TABLE public.qr_tokens 
  ADD COLUMN IF NOT EXISTS qr_image_url TEXT,
  ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_deep_link TEXT,
  ADD COLUMN IF NOT EXISTS table_label TEXT,
  ADD COLUMN IF NOT EXISTS printed BOOLEAN DEFAULT FALSE;

-- Add index for scan analytics (most scanned tables)
CREATE INDEX IF NOT EXISTS qr_tokens_scan_count_idx 
  ON public.qr_tokens(scan_count DESC) 
  WHERE scan_count > 0;

-- Add index for recent scans
CREATE INDEX IF NOT EXISTS qr_tokens_last_scan_idx 
  ON public.qr_tokens(last_scan_at DESC NULLS LAST);

-- Add index for station lookup (already exists, but ensure it's there)
CREATE INDEX IF NOT EXISTS qr_tokens_station_table_idx 
  ON public.qr_tokens(station_id, table_label);

-- Optimize token lookup with hash index for exact matches
CREATE INDEX IF NOT EXISTS qr_tokens_token_hash_idx 
  ON public.qr_tokens USING hash(token);

-- Add comment for documentation
COMMENT ON COLUMN public.qr_tokens.qr_image_url IS 'URL/path to generated QR code image (PNG/SVG)';
COMMENT ON COLUMN public.qr_tokens.scan_count IS 'Number of times this QR code has been scanned';
COMMENT ON COLUMN public.qr_tokens.last_scan_at IS 'Timestamp of most recent scan for analytics';
COMMENT ON COLUMN public.qr_tokens.whatsapp_deep_link IS 'Pre-generated wa.me deep link for this QR code';
COMMENT ON COLUMN public.qr_tokens.table_label IS 'Human-readable table identifier (e.g., "Table 5")';

-- Create function to increment scan count atomically
CREATE OR REPLACE FUNCTION public.increment_qr_scan(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.qr_tokens
  SET 
    scan_count = scan_count + 1,
    last_scan_at = NOW()
  WHERE token = p_token;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_qr_scan(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_qr_scan(TEXT) TO anon;

COMMIT;
