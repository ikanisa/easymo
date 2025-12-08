-- Create menu_upload_requests table for restaurant menu workflow
-- Fixes: Support for restaurant menu upload feature used in wa-webhook

BEGIN;

-- Create menu_upload_requests table
CREATE TABLE IF NOT EXISTS public.menu_upload_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  items_extracted INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  processed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'approved', 'rejected'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_upload_requests_bar ON public.menu_upload_requests(bar_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_upload_requests_status ON public.menu_upload_requests(status, created_at);

-- Enable RLS
ALTER TABLE public.menu_upload_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for now - can be tightened later)
DROP POLICY IF EXISTS menu_upload_requests_allow_service_role ON public.menu_upload_requests;
CREATE POLICY menu_upload_requests_allow_service_role
  ON public.menu_upload_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.menu_upload_requests IS 'Tracks menu file uploads for OCR processing and approval workflow';

COMMIT;
