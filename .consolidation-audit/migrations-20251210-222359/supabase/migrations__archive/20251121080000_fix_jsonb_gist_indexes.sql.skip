-- Fix JSONB GIST index issue for farms.metadata
-- The previous migration attempted to create a GIST index on a JSONB column, which is not supported.
-- We replace it with a GIN index, which is appropriate for JSONB containment queries.

BEGIN;

-- Drop the problematic GIST index if it exists
DROP INDEX IF EXISTS public.idx_farms_location;

-- Create a proper GIN index on the metadata column
CREATE INDEX IF NOT EXISTS idx_farms_metadata ON public.farms USING GIN (metadata);

COMMIT;
