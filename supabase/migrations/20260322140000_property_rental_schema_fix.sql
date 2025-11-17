BEGIN;

-- Refresh property RLS policies so owner_id can change type safely
DROP POLICY IF EXISTS "Users can insert own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can view own inquiries" ON public.property_inquiries;
DROP POLICY IF EXISTS "Users can create inquiries" ON public.property_inquiries;
DROP POLICY IF EXISTS "Users can create reviews" ON public.property_reviews;

-- Ensure owner_id is a UUID linked to auth.users
ALTER TABLE public.properties
  ALTER COLUMN owner_id TYPE uuid USING owner_id::uuid;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_owner_id_fkey;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Recreate policies with UUID-safe comparisons
CREATE POLICY "Users can insert own properties"
  ON public.properties FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own properties"
  ON public.properties FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own inquiries"
  ON public.property_inquiries FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT owner_id FROM public.properties WHERE id = property_id)
  );

CREATE POLICY "Users can create inquiries"
  ON public.property_inquiries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can create reviews"
  ON public.property_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow property owners as a vendor type in agent_quotes
ALTER TABLE public.agent_quotes
  DROP CONSTRAINT IF EXISTS agent_quotes_vendor_type_check;

ALTER TABLE public.agent_quotes
  ADD CONSTRAINT agent_quotes_vendor_type_check
    CHECK (vendor_type = ANY (ARRAY['driver','pharmacy','quincaillerie','shop','restaurant','other','property_owner']));

-- Update search_nearby_properties to read profile data instead of auth.users
CREATE OR REPLACE FUNCTION public.search_nearby_properties(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_rental_type TEXT DEFAULT NULL,
  p_bedrooms INTEGER DEFAULT NULL,
  p_min_budget DECIMAL DEFAULT 0,
  p_max_budget DECIMAL DEFAULT 999999999
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  owner_name TEXT,
  rental_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  price DECIMAL,
  address TEXT,
  amenities TEXT[],
  images TEXT[],
  distance DOUBLE PRECISION,
  available_from TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.owner_id,
    COALESCE(pr.display_name, pr.whatsapp_e164, 'Property owner') AS owner_name,
    p.rental_type,
    p.bedrooms,
    p.bathrooms,
    p.price,
    p.address,
    p.amenities,
    p.images,
    ST_DistanceSphere(p.location::geometry, ST_MakePoint(p_longitude, p_latitude)::geometry) / 1000.0 AS distance,
    p.available_from,
    p.status
  FROM public.properties p
  LEFT JOIN public.profiles pr ON pr.user_id = p.owner_id
  WHERE 
    p.status = 'available'
    AND ST_DWithin(
      p.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography,
      p_radius_km * 1000
    )
    AND (p_rental_type IS NULL OR p.rental_type = p_rental_type)
    AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
    AND p.price BETWEEN p_min_budget AND p_max_budget
  ORDER BY distance ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

COMMIT;
