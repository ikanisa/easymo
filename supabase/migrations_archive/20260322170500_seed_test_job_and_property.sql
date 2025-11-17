BEGIN;

-- Seed a minimal test job listing if table exists and empty
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='job_listings'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM public.job_listings) THEN
      INSERT INTO public.job_listings (
        posted_by, poster_name, title, description, job_type, category,
        location, pay_type, currency, status
      ) VALUES (
        'system', 'System Seeder', 'Test Job Listing',
        'This is a test job record for validation of the pipeline.',
        'gig', NULL,
        'Kigali, Rwanda', 'negotiable', 'RWF', 'open'
      );
    END IF;
  END IF;
END $$;

-- Seed a minimal test property listing if table exists and empty
DO $$
DECLARE
  owner_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='property_listings'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM public.property_listings) THEN
      owner_id := (
        SELECT value::uuid FROM public.app_settings WHERE key='app.property_owner_id'
      );
      IF owner_id IS NULL THEN
        owner_id := 'c7a4b3da-a9b4-4dc8-92f3-6d457dd2f888'::uuid;
      END IF;
      INSERT INTO public.property_listings (
        owner_id, rental_type, bedrooms, bathrooms, price, location, address,
        amenities, images, status, available_from
      ) VALUES (
        owner_id, 'long_term', 2, 1, 300000,
        jsonb_build_object('address','Kigali','city','Kigali','country','RW'),
        'Kigali, Rwanda', ARRAY['WiFi','Parking'], ARRAY[]::text[], 'available', CURRENT_DATE
      );
    END IF;
  END IF;
END $$;

COMMIT;

