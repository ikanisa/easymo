BEGIN;

-- Migration: Add vector embeddings for semantic business search
-- Date: 2025-11-12
-- Description: Adds pgvector support for semantic search of businesses by name

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to businesses table
ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS name_embedding vector(1536);

-- Create index for vector similarity search
-- Using ivfflat for efficient approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_businesses_name_embedding 
  ON public.businesses 
  USING ivfflat (name_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function to perform semantic search on business names
CREATE OR REPLACE FUNCTION public.search_businesses_by_name_similarity(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 8,
  min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  location_text TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.description,
    b.location_text,
    1 - (b.name_embedding <=> query_embedding) AS similarity
  FROM public.businesses b
  WHERE b.is_active = TRUE
    AND b.name_embedding IS NOT NULL
    AND (1 - (b.name_embedding <=> query_embedding)) > min_similarity
  ORDER BY b.name_embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_businesses_by_name_similarity(vector(1536), INTEGER, FLOAT) TO authenticated;

-- Function to get nearest businesses by location with optional category filter
CREATE OR REPLACE FUNCTION public.search_businesses_by_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_category_id BIGINT DEFAULT NULL,
  p_max_distance_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  location_text TEXT,
  category_id BIGINT,
  distance_meters NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.description,
    b.location_text,
    b.category_id,
    ST_Distance(
      b.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_meters
  FROM public.businesses b
  WHERE b.is_active = TRUE
    AND b.location IS NOT NULL
    AND (p_category_id IS NULL OR b.category_id = p_category_id)
    AND ST_DWithin(
      b.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_max_distance_km * 1000
    )
  ORDER BY b.location::geography <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_businesses_by_location(DOUBLE PRECISION, DOUBLE PRECISION, BIGINT, DOUBLE PRECISION, INTEGER) TO authenticated;

-- Function to check if business name exists (for duplicate detection)
CREATE OR REPLACE FUNCTION public.check_similar_business_names(
  p_name TEXT,
  p_owner_whatsapp TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  owner_whatsapp TEXT,
  is_own_business BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.owner_whatsapp,
    (b.owner_whatsapp = p_owner_whatsapp) AS is_own_business
  FROM public.businesses b
  WHERE b.is_active = TRUE
    AND LOWER(b.name) = LOWER(p_name)
  ORDER BY (b.owner_whatsapp = p_owner_whatsapp) DESC, b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_similar_business_names(TEXT, TEXT) TO authenticated;

COMMIT;
