-- Fix insurance_documents table to match expected schema
BEGIN;

-- Check if insurance_documents table exists and has the wrong schema
DO $$
BEGIN
  -- If the table exists but doesn't have request_id column, we need to fix it
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'insurance_documents') THEN
    
    -- Add request_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'insurance_documents' 
                   AND column_name = 'request_id') THEN
      
      -- Add the missing columns
      ALTER TABLE public.insurance_documents 
        ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.insurance_requests(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.insurance_policies(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS doc_type text,
        ADD COLUMN IF NOT EXISTS storage_path text,
        ADD COLUMN IF NOT EXISTS source text DEFAULT 'upload',
        ADD COLUMN IF NOT EXISTS ocr_payload jsonb DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS ocr_confidence numeric(5,2) CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
        ADD COLUMN IF NOT EXISTS uploaded_by text,
        ADD COLUMN IF NOT EXISTS uploaded_at timestamptz DEFAULT timezone('utc', now());
      
      RAISE NOTICE 'Added missing columns to insurance_documents table';
    END IF;
  END IF;
END $$;

-- Now create the indexes safely
CREATE INDEX IF NOT EXISTS insurance_documents_request_idx ON public.insurance_documents(request_id);
CREATE INDEX IF NOT EXISTS insurance_documents_policy_idx ON public.insurance_documents(policy_id);

COMMIT;
