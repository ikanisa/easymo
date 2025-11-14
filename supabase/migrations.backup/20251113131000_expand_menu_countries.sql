BEGIN;

-- Update active_countries for all menu items to include all applicable countries
-- This makes menu items available across all 31 countries

-- Update MOMO QR to be available in all countries (with country-specific names)
UPDATE whatsapp_home_menu_items
SET active_countries = ARRAY[
  'RW','UG','KE','TZ','BI','CM','CD','CG','GA','CF','TD','GQ',
  'GH','CI','BJ','BF','SN','TG','ML','GN','NE','MR','ZM','ZW',
  'MW','NA','MG','MU','SC','KM','DJ'
]
WHERE key = 'momo_qr';

-- Update other menu items to be available in all countries
UPDATE whatsapp_home_menu_items
SET active_countries = ARRAY[
  'RW','UG','KE','TZ','BI','CM','CD','CG','GA','CF','TD','GQ',
  'GH','CI','BJ','BF','SN','TG','ML','GN','NE','MR','ZM','ZW',
  'MW','NA','MG','MU','SC','KM','DJ'
]
WHERE key IN ('nearby_drivers', 'nearby_passengers', 'schedule_trip', 'nearby_pharmacies', 
              'quincailleries', 'shops_services', 'property_rentals', 'bars_restaurants', 
              'customer_support');

-- Motor Insurance and Notary Services remain RW-only for now
-- They already have active_countries = {RW}

COMMIT;
