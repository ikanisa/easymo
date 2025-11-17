-- Add feature columns to business table for bars/restaurants
-- =========================================================================================
BEGIN;

-- Add feature columns to business table
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS has_live_music boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_parking boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_free_wifi boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_family_friendly boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_vegetarian_options boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_live_sports boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_outdoor_seating boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_late_night_hours boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_events boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_karaoke boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_happy_hour boolean DEFAULT false;

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_business_live_music ON public.business(has_live_music) WHERE has_live_music = true;
CREATE INDEX IF NOT EXISTS idx_business_parking ON public.business(has_parking) WHERE has_parking = true;
CREATE INDEX IF NOT EXISTS idx_business_wifi ON public.business(has_free_wifi) WHERE has_free_wifi = true;
CREATE INDEX IF NOT EXISTS idx_business_family_friendly ON public.business(is_family_friendly) WHERE is_family_friendly = true;
CREATE INDEX IF NOT EXISTS idx_business_vegetarian ON public.business(has_vegetarian_options) WHERE has_vegetarian_options = true;
CREATE INDEX IF NOT EXISTS idx_business_sports ON public.business(has_live_sports) WHERE has_live_sports = true;
CREATE INDEX IF NOT EXISTS idx_business_outdoor ON public.business(has_outdoor_seating) WHERE has_outdoor_seating = true;
CREATE INDEX IF NOT EXISTS idx_business_late_night ON public.business(has_late_night_hours) WHERE has_late_night_hours = true;

-- Add comments
COMMENT ON COLUMN public.business.has_live_music IS 'Whether the business has live music';
COMMENT ON COLUMN public.business.has_parking IS 'Whether the business has parking available';
COMMENT ON COLUMN public.business.has_free_wifi IS 'Whether the business offers free WiFi';
COMMENT ON COLUMN public.business.is_family_friendly IS 'Whether the business is family friendly';
COMMENT ON COLUMN public.business.has_vegetarian_options IS 'Whether the business has vegetarian options';
COMMENT ON COLUMN public.business.has_live_sports IS 'Whether the business shows live sports';
COMMENT ON COLUMN public.business.has_outdoor_seating IS 'Whether the business has outdoor seating';
COMMENT ON COLUMN public.business.has_late_night_hours IS 'Whether the business is open late night';
COMMENT ON COLUMN public.business.has_events IS 'Whether the business hosts events';
COMMENT ON COLUMN public.business.has_karaoke IS 'Whether the business has karaoke';
COMMENT ON COLUMN public.business.has_happy_hour IS 'Whether the business has happy hour';

-- Update the nearby_bars_by_preference function to use business table
DROP FUNCTION IF EXISTS public.nearby_bars_by_preference(double precision, double precision, text, double precision, integer);

CREATE OR REPLACE FUNCTION public.nearby_bars_by_preference(
  user_lat double precision,
  user_lon double precision,
  preference text,
  radius_km double precision DEFAULT 10.0,
  _limit integer DEFAULT 9
)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  location_text text,
  country text,
  city_area text,
  latitude double precision,
  longitude double precision,
  whatsapp_number text,
  distance_km double precision,
  features jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.id,
    b.name,
    b.tag as slug,
    b.location_text,
    b.country,
    NULL::text as city_area,
    b.latitude,
    b.longitude,
    b.owner_whatsapp as whatsapp_number,
    CASE
      WHEN b.location IS NOT NULL THEN 
        (ST_Distance(
          b.location, 
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography
        ) / 1000.0)::double precision
      WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN 
        public.haversine_km(b.latitude, b.longitude, user_lat, user_lon)
      ELSE NULL
    END AS distance_km,
    jsonb_build_object(
      'has_live_music', b.has_live_music,
      'has_parking', b.has_parking,
      'has_free_wifi', b.has_free_wifi,
      'is_family_friendly', b.is_family_friendly,
      'has_vegetarian_options', b.has_vegetarian_options,
      'has_live_sports', b.has_live_sports,
      'has_outdoor_seating', b.has_outdoor_seating,
      'has_late_night_hours', b.has_late_night_hours,
      'has_events', b.has_events,
      'has_karaoke', b.has_karaoke,
      'has_happy_hour', b.has_happy_hour
    ) as features
  FROM public.business b
  WHERE
    b.is_active = true
    AND b.tag = 'Bar & Restaurant'
    AND (b.latitude IS NOT NULL AND b.longitude IS NOT NULL)
    -- Filter by preference (feature)
    AND (
      CASE preference
        WHEN 'live_music' THEN b.has_live_music = true
        WHEN 'parking' THEN b.has_parking = true
        WHEN 'free_wifi' THEN b.has_free_wifi = true
        WHEN 'family_friendly' THEN b.is_family_friendly = true
        WHEN 'vegetarian' THEN b.has_vegetarian_options = true
        WHEN 'live_sports' THEN b.has_live_sports = true
        WHEN 'outdoor_seating' THEN b.has_outdoor_seating = true
        WHEN 'late_night' THEN b.has_late_night_hours = true
        WHEN 'events' THEN b.has_events = true
        WHEN 'karaoke' THEN b.has_karaoke = true
        WHEN 'happy_hour' THEN b.has_happy_hour = true
        ELSE true  -- 'all' or unknown returns all bars
      END
    )
    AND (
      -- Filter by radius
      CASE
        WHEN b.location IS NOT NULL THEN 
          (ST_Distance(
            b.location, 
            ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography
          ) / 1000.0) <= radius_km
        WHEN b.latitude IS NOT NULL AND b.longitude IS NOT NULL THEN 
          public.haversine_km(b.latitude, b.longitude, user_lat, user_lon) <= radius_km
        ELSE false
      END
    )
  ORDER BY distance_km ASC NULLS LAST
  LIMIT _limit;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.nearby_bars_by_preference(double precision, double precision, text, double precision, integer) TO anon, authenticated;

-- Add comment
COMMENT ON FUNCTION public.nearby_bars_by_preference IS 'Search for nearby bars & restaurants from business table, filtered by preference';

SELECT 'Business features added and bars search function updated' AS status;

COMMIT;
