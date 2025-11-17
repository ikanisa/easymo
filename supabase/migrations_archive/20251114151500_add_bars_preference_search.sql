-- Add preference-based bars search function
-- =========================================================================================
BEGIN;

-- Create function to search bars by preference (feature filter)
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
    b.slug,
    b.location_text,
    b.country,
    b.city_area,
    b.latitude,
    b.longitude,
    b.whatsapp_number,
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
    b.features
  FROM public.bars b
  WHERE
    b.is_active = true
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
COMMENT ON FUNCTION public.nearby_bars_by_preference IS 'Search for nearby bars filtered by user preference (live_music, parking, free_wifi, etc.)';

SELECT 'Preference-based bars search function created successfully' AS status;

COMMIT;
