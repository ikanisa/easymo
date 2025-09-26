-- Marketplace enhanced nearby lookup supporting category slugs.

CREATE OR REPLACE FUNCTION public.nearby_businesses_v2(
  _lat double precision,
  _lng double precision,
  _viewer text,
  _category_slug text DEFAULT NULL,
  _limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  owner_whatsapp text,
  name text,
  description text,
  location_text text,
  category_slug text,
  distance_km double precision
)
LANGUAGE sql
AS $$
  SELECT b.id,
         b.owner_whatsapp,
         b.name,
         b.description,
         b.location_text,
         mc.slug AS category_slug,
         CASE
           WHEN b.lat IS NULL OR b.lng IS NULL THEN NULL
           ELSE public.haversine_km(b.lat, b.lng, _lat, _lng)
         END AS distance_km
  FROM public.businesses b
  LEFT JOIN public.marketplace_categories mc ON mc.id = b.category_id
  WHERE b.is_active = true
    AND (
      _category_slug IS NULL OR _category_slug = '' OR
      lower(coalesce(mc.slug, '')) = lower(_category_slug)
    )
  ORDER BY distance_km NULLS LAST, b.created_at DESC
  LIMIT COALESCE(_limit, 10);
$$;
