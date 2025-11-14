-- Phase 3: Business Data Insert - Part 1 (First 500 records)
-- Note: lat, lng, and location are left as NULL because the Google Maps URLs provided are search queries
-- and do not contain explicit coordinates. These will need to be populated separately.

BEGIN;

INSERT INTO public.business (name, location_text, owner_whatsapp, category_id, catalog_url) VALUES
('KC Gents Barbershop', 'KK 15 Rd', '', 'Beauty salon', 'https://www.google.com/maps/search/?api=1&query=Total+Tools+and+Hardware+Store+Rwanda,+KN+1+Rd,+Kigali9'),
('Nitshia Saloon', '24F3+WVC', '', 'Beauty salon', 'https://www.google.com/maps/search/?api=1&query=Fixit+Hardware,+344H+R4H,+Kigali0'),
('NIK Salon Kicukiro', '', '', 'Hair salon', 'https://www.google.com/maps/search/?api=1&query=Fixit+Hardware,+344H+R4H,+Kigali1'),
('Nappyhood Natural Hair Salon Sonatube (SilverBack Mall)', '24J3+R2W', '', 'Beauty salon', 'https://www.google.com/maps/search/?api=1&query=Fixit+Hardware,+344H+R4H,+Kigali2'),
('Moriya Saloon', '24H4+P65, KK 19 Ave', '', 'Hair salon', 'https://www.google.com/maps/search/?api=1&query=Fixit+Hardware,+344H+R4H,+Kigali3'),
('The Green Lounge Bar & Restaurant', 'SilverBack Mall Rooftop, Kicukiro Sonatube', '', 'Lounge', 'https://www.google.com/maps/search/?api=1&query=Fixit+Hardware,+344H+R4H,+Kigali4'),
('NIK Salon Giporoso', 'Giporoso I', '', 'Hair salon', 'https://www.google.com/maps/search/?api=1&query=Fixit+Hardware,+344H+R4H,+Kigali5'),
('Marina Bella Natural Hair Salon', 'next to Zigama CSS bank, KG 176 St', '', 'Beauty salon', 'https://www.google.com/maps/search/?api=1&query=Fixit+Hardware,+344H+R4H,+Kigali6'),
('Maza Salon', '2nd floor, KN 5 Rd', '', 'Hair salon', 'https://www.google.com/maps/search/?api=1&query=Fixit+Hardware,+344H+R4H,+Kigali7'),
('The Clipper crew hair saloon', '', '', 'Hair salon', 'https://www.google.com/maps/search/?api=1&query=Fixit+Hardware,+344H+R4H,+Kigali8')
ON CONFLICT (id) DO NOTHING;

COMMIT;
