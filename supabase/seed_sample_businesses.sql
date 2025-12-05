-- Sample businesses for testing Buy & Sell feature
-- Run this if your businesses table is empty

BEGIN;

-- Insert sample pharmacies in Kigali, Rwanda
INSERT INTO public.businesses (name, category, lat, lng, owner_whatsapp, address, phone, description, is_active)
VALUES 
  ('City Pharmacy Kigali', 'Pharmacy', -1.9536, 30.0606, '250788123456', 'KN 4 Ave, Kigali', '+250788123456', 'Open 24/7, wide range of medications', true),
  ('Health Plus Pharmacy', 'Pharmacy', -1.9447, 30.0589, '250788123457', 'KG 11 Ave, Kimihurura', '+250788123457', 'Specialist pharmacy with consultations', true),
  ('Care Pharmacy Nyarutarama', 'Pharmacy', -1.9510, 30.0920, '250788123458', 'Nyarutarama, Kigali', '+250788123458', 'Family pharmacy, affordable prices', true),
  ('Central Pharmacy', 'Pharmacy', -1.9570, 30.0610, '250788123459', 'City Center, Kigali', '+250788123459', 'Central location, quick service', true),
  ('MediCare Pharmacy', 'Pharmacy', -1.9500, 30.0650, '250788123460', 'KN 3 Rd, Kigali', '+250788123460', 'Medical supplies and equipment', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample salons in Kigali
INSERT INTO public.businesses (name, category, lat, lng, owner_whatsapp, address, phone, description, is_active)
VALUES 
  ('Elegance Salon', 'Salon', -1.9520, 30.0615, '250788234567', 'KN 5 Ave, Kigali', '+250788234567', 'Hair, nails, makeup services', true),
  ('Gents Barber Shop', 'Salon', -1.9480, 30.0600, '250788234568', 'Kimihurura', '+250788234568', 'Professional barber, modern styles', true),
  ('Beauty Zone', 'Salon', -1.9550, 30.0920, '250788234569', 'Nyarutarama', '+250788234569', 'Full beauty services for ladies', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample beauty shops
INSERT INTO public.businesses (name, category, lat, lng, owner_whatsapp, address, phone, description, is_active)
VALUES 
  ('Glam Cosmetics', 'Beauty Shop', -1.9530, 30.0620, '250788345678', 'City Plaza, Kigali', '+250788345678', 'Makeup, skincare, fragrances', true),
  ('Beauty Haven', 'Beauty Shop', -1.9490, 30.0590, '250788345679', 'Kimihurura', '+250788345679', 'Natural beauty products', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample electronics stores
INSERT INTO public.businesses (name, category, lat, lng, owner_whatsapp, address, phone, description, is_active)
VALUES 
  ('TechHub Electronics', 'Electronics Store', -1.9540, 30.0625, '250788456789', 'KN 2 Ave, Kigali', '+250788456789', 'Phones, laptops, accessories', true),
  ('Digital World', 'Electronics Store', -1.9460, 30.0580, '250788456790', 'Kimihurura', '+250788456790', 'Latest gadgets and electronics', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample supermarkets
INSERT INTO public.businesses (name, category, lat, lng, owner_whatsapp, address, phone, description, is_active)
VALUES 
  ('Fresh Market', 'Supermarket', -1.9545, 30.0630, '250788567890', 'City Center', '+250788567890', 'Fresh groceries daily', true),
  ('City Supermarket', 'Supermarket', -1.9470, 30.0595, '250788567891', 'Kimihurura', '+250788567891', 'Wide variety of products', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample hardware stores
INSERT INTO public.businesses (name, category, lat, lng, owner_whatsapp, address, phone, description, is_active)
VALUES 
  ('BuildMaster Hardware', 'Hardware Store', -1.9555, 30.0635, '250788678901', 'Industrial Area', '+250788678901', 'Construction materials and tools', true),
  ('Home Fix Hardware', 'Hardware Store', -1.9485, 30.0585, '250788678902', 'Remera', '+250788678902', 'DIY tools and supplies', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample auto repair shops
INSERT INTO public.businesses (name, category, lat, lng, owner_whatsapp, address, phone, description, is_active)
VALUES 
  ('AutoCare Garage', 'Auto Repair', -1.9560, 30.0640, '250788789012', 'Gikondo', '+250788789012', 'Full car service and repair', true),
  ('Quick Fix Auto', 'Auto Repair', -1.9475, 30.0575, '250788789013', 'Remera', '+250788789013', 'Fast reliable auto service', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample clothing stores
INSERT INTO public.businesses (name, category, lat, lng, owner_whatsapp, address, phone, description, is_active)
VALUES 
  ('Fashion Plus', 'Clothing Store', -1.9525, 30.0618, '250788890123', 'City Center', '+250788890123', 'Latest fashion trends', true),
  ('Style Boutique', 'Clothing Store', -1.9495, 30.0592, '250788890124', 'Kimihurura', '+250788890124', 'Quality clothing for all', true)
ON CONFLICT (id) DO NOTHING;

-- Insert some businesses in Bujumbura, Burundi for testing multi-country
INSERT INTO public.businesses (name, category, lat, lng, owner_whatsapp, address, phone, description, is_active, country)
VALUES 
  ('Pharmacie Centrale', 'Pharmacy', -3.3761, 29.3644, '25778123456', 'Av. du Commerce, Bujumbura', '+25778123456', 'Pharmacie bien équipée', true, 'BI'),
  ('Salon Elite', 'Salon', -3.3770, 29.3650, '25778234567', 'Centre Ville, Bujumbura', '+25778234567', 'Coiffure et beauté', true, 'BI')
ON CONFLICT (id) DO NOTHING;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_businesses_location ON public.businesses (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_category_active ON public.businesses (category, is_active);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON public.businesses (country) WHERE country IS NOT NULL;

-- Verify insertion
DO $$
DECLARE
  business_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO business_count FROM public.businesses WHERE is_active = true;
  RAISE NOTICE 'Total active businesses: %', business_count;
  
  SELECT COUNT(*) INTO business_count FROM public.businesses WHERE category = 'Pharmacy' AND is_active = true;
  RAISE NOTICE 'Active pharmacies: %', business_count;
END $$;

COMMIT;

-- Show sample data
SELECT category, COUNT(*) as count, MIN(name) as sample_name
FROM public.businesses 
WHERE is_active = true 
GROUP BY category 
ORDER BY count DESC;
