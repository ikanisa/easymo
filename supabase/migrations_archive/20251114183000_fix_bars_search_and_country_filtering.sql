-- Fix bars search to use tag_id and proper country filtering
-- =========================================================================================
BEGIN;

-- Update nearby_bars_by_preference to use tag_id and filter properly by country
CREATE OR REPLACE FUNCTION public.nearby_bars_by_preference(
  user_lat double precision,
  user_lon double precision,
  preference text,
  radius_km double precision DEFAULT 10.0,
  _limit integer DEFAULT 27
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
    -- Use tag_id to reference the Bar & Restaurant tag
    AND b.tag_id = '3e1154e5-62bc-469f-a5a1-0698f017c47e'::uuid
    AND (b.latitude IS NOT NULL AND b.longitude IS NOT NULL)
    -- Country filter: accept RW, Rwanda, RWANDA, rw, rwanda, or any case variation
    AND (
      UPPER(b.country) = 'RW' 
      OR UPPER(b.country) = 'RWANDA'
      OR UPPER(b.country) = 'MALTA'
      OR UPPER(b.country) = 'MT'
      OR UPPER(b.country) = 'UGANDA'
      OR UPPER(b.country) = 'UG'
      OR UPPER(b.country) = 'KENYA'
      OR UPPER(b.country) = 'KE'
      OR UPPER(b.country) = 'TANZANIA'
      OR UPPER(b.country) = 'TZ'
    )
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.nearby_bars_by_preference(double precision, double precision, text, double precision, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.nearby_bars_by_preference IS 'Search for nearby bars & restaurants from business table using tag_id, filtered by preference and country';

SELECT 'Bars search function updated with tag_id and country filtering' AS status;

COMMIT;
