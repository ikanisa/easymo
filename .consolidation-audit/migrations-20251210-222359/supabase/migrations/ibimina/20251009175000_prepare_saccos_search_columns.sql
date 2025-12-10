-- Ensure SACCO search metadata columns exist before normalization cleanup
ALTER TABLE public.saccos
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS search_slug TEXT,
  ADD COLUMN IF NOT EXISTS search_document TSVECTOR;

CREATE INDEX IF NOT EXISTS saccos_search_document_idx ON public.saccos USING GIN(search_document);
