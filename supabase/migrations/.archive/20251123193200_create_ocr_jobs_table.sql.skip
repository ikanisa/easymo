-- Create OCR jobs table for menu upload processing
-- Fixes: Could not find the table 'public.ocr_jobs' in the schema cache

BEGIN;

-- Create enum for OCR job status if not exists
DO $$ BEGIN
  CREATE TYPE public.ocr_job_status AS ENUM ('queued', 'processing', 'succeeded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create ocr_jobs table
CREATE TABLE IF NOT EXISTS public.ocr_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  menu_id uuid, -- Nullable, no FK constraint (menus table may not exist)
  source_file_id text,
  status public.ocr_job_status NOT NULL DEFAULT 'queued',
  error_message text,
  attempts smallint NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  result_path text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status_created ON public.ocr_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_bar_id ON public.ocr_jobs(bar_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_menu_id ON public.ocr_jobs(menu_id);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS trg_ocr_jobs_updated ON public.ocr_jobs;
CREATE TRIGGER trg_ocr_jobs_updated
  BEFORE UPDATE ON public.ocr_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.ocr_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for now - can be tightened later)
DROP POLICY IF EXISTS ocr_jobs_allow_service_role ON public.ocr_jobs;
CREATE POLICY ocr_jobs_allow_service_role ON public.ocr_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.ocr_jobs IS 'Queue for OCR processing jobs on uploaded menu images/documents';

COMMIT;
