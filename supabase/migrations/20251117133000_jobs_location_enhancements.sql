BEGIN;

ALTER TABLE job_listings
  ADD COLUMN IF NOT EXISTS geog geography(POINT, 4326);

CREATE INDEX IF NOT EXISTS job_listings_geog_idx
  ON job_listings
  USING GIST (geog);

DROP FUNCTION IF EXISTS get_nearby_jobs(double precision, double precision, job_type[], integer);

CREATE OR REPLACE FUNCTION get_nearby_jobs(
  p_lat double precision,
  p_lng double precision,
  p_job_types job_type[] DEFAULT NULL,
  p_limit integer DEFAULT 27
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  job_type job_type,
  location text,
  pay_min numeric,
  pay_max numeric,
  pay_type pay_type,
  currency text,
  company_name text,
  contact_phone text,
  posted_by text,
  created_at timestamptz,
  distance_km double precision
)
LANGUAGE sql STABLE
AS $$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS point
  )
  SELECT
    jl.id,
    jl.title,
    jl.description,
    jl.job_type,
    jl.location,
    jl.pay_min,
    jl.pay_max,
    jl.pay_type,
    jl.currency,
    jl.company_name,
    COALESCE(jl.contact_phone, jl.posted_by) AS contact_phone,
    jl.posted_by,
    jl.created_at,
    CASE
      WHEN jl.geog IS NOT NULL THEN round(ST_Distance(jl.geog, origin.point) / 1000.0, 2)
      ELSE NULL
    END AS distance_km
  FROM origin, job_listings jl
  WHERE jl.status = 'open'
    AND jl.geog IS NOT NULL
    AND (p_job_types IS NULL OR jl.job_type = ANY(p_job_types))
  ORDER BY jl.created_at DESC
  LIMIT p_limit;
$$;

COMMIT;
