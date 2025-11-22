-- Function to update business location geometry
CREATE OR REPLACE FUNCTION public.update_business_location(biz_id TEXT, lat DECIMAL, lng DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE public.business_directory
  SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  WHERE external_id = biz_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
