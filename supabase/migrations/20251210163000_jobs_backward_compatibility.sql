-- Migration: Jobs Backward Compatibility
-- Description: Create views for backward compatibility with old table names
-- Date: 2025-12-10

BEGIN;

-- ============================================================
-- BACKWARD COMPATIBILITY VIEWS
-- ============================================================

-- Create view for job_posts → job_listings
-- This ensures any code referencing job_posts still works
CREATE OR REPLACE VIEW job_posts AS 
SELECT 
  id,
  "tenantId",
  title,
  description,
  category,
  job_type as employment_type,
  location,
  pay_min as salary_min,
  pay_max as salary_max,
  pay_type,
  currency,
  status,
  posted_by as company_name,
  expires_at,
  created_at,
  updated_at,
  embedding,
  user_id,
  country_code,
  required_skills,
  is_external,
  external_url,
  source_url,
  external_id,
  last_scraped_at,
  verified as is_verified,
  source_id,
  job_hash,
  raw_data,
  lat,
  lng,
  location_geography
FROM job_listings;

-- Create view for worker_profiles → job_seekers
CREATE OR REPLACE VIEW worker_profiles AS
SELECT
  id,
  "tenantId",
  user_id,
  name,
  phone,
  skills,
  experience as experience_years,
  location,
  location_preference as preferred_location,
  resume_url,
  last_active,
  created_at,
  updated_at,
  embedding,
  country_code,
  availability
FROM job_seekers;

-- Create view for job_applications → job_matches
CREATE OR REPLACE VIEW job_applications AS
SELECT
  id,
  job_id,
  seeker_id as user_id,
  status,
  created_at as applied_at,
  score as match_score
FROM job_matches;

-- ============================================================
-- UNIFIED SEARCH FUNCTION
-- ============================================================

-- Create a unified search function that works with both old and new code
CREATE OR REPLACE FUNCTION search_jobs_unified(
  p_query TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_min_salary NUMERIC DEFAULT NULL,
  p_max_salary NUMERIC DEFAULT NULL,
  p_employment_type TEXT DEFAULT NULL,
  p_experience_level TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  title TEXT,
  company_name TEXT,
  location TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  currency TEXT,
  employment_type TEXT,
  category TEXT,
  description TEXT,
  status TEXT,
  is_verified BOOLEAN,
  created_at TIMESTAMPTZ,
  match_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jl.id,
    jl.title,
    jl.posted_by as company_name,
    jl.location,
    jl.pay_min as salary_min,
    jl.pay_max as salary_max,
    jl.currency,
    jl.job_type as employment_type,
    jl.category,
    jl.description,
    jl.status,
    jl.verified as is_verified,
    jl.created_at,
    CASE
      -- Calculate match score based on criteria
      WHEN p_location IS NOT NULL AND jl.location ILIKE '%' || p_location || '%' THEN 0.9
      WHEN p_category IS NOT NULL AND jl.category = p_category THEN 0.8
      ELSE 0.7
    END as match_score
  FROM job_listings jl
  WHERE jl.status = 'active'
    AND (p_query IS NULL OR jl.title ILIKE '%' || p_query || '%' OR jl.description ILIKE '%' || p_query || '%')
    AND (p_location IS NULL OR jl.location ILIKE '%' || p_location || '%')
    AND (p_category IS NULL OR jl.category = p_category)
    AND (p_min_salary IS NULL OR jl.pay_min >= p_min_salary)
    AND (p_max_salary IS NULL OR jl.pay_max <= p_max_salary)
    AND (p_employment_type IS NULL OR jl.job_type = p_employment_type)
  ORDER BY 
    match_score DESC,
    jl.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- GRANTS
-- ============================================================

-- Grant permissions on views
GRANT SELECT ON job_posts TO authenticated, anon;
GRANT SELECT ON worker_profiles TO authenticated, anon;
GRANT SELECT ON job_applications TO authenticated, anon;

-- Grant execute on search function
GRANT EXECUTE ON FUNCTION search_jobs_unified(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, INTEGER) TO authenticated, anon;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON VIEW job_posts IS 'Backward compatibility view for job_listings table';
COMMENT ON VIEW worker_profiles IS 'Backward compatibility view for job_seekers table';
COMMENT ON VIEW job_applications IS 'Backward compatibility view for job_matches table';
COMMENT ON FUNCTION search_jobs_unified IS 'Unified job search function supporting both old and new schemas';

COMMIT;
