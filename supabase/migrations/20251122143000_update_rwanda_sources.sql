-- Transaction wrapper for production safety
BEGIN;

-- Update Jobs Source
UPDATE public.listing_sources
SET config = '{
  "country": "Rwanda",
  "queries": [
    "jobs in Rwanda",
    "jobs in Kigali",
    "remote jobs Rwanda",
    "driver jobs Kigali",
    "construction jobs Rwanda",
    "waiter jobs Kigali",
    "security jobs Rwanda",
    "site:linkedin.com/jobs Rwanda",
    "site:jobinrwanda.com",
    "site:umucyo.gov.rw",
    "site:tohoza.com jobs"
  ]
}'
WHERE name = 'Rwanda Jobs Search';

-- Update Real Estate Source
UPDATE public.listing_sources
SET config = '{
  "country": "Rwanda",
  "queries": [
    "apartments for rent Kigali",
    "houses for sale Kigali",
    "land for sale Rwanda",
    "commercial property for rent Kigali",
    "site:airbnb.com Rwanda",
    "site:booking.com hotels Rwanda",
    "site:hotels.com Rwanda",
    "site:plaka.rw",
    "site:igihe.com real estate",
    "site:tohoza.com real estate"
  ]
}'
WHERE name = 'Rwanda Real Estate Search';

COMMIT;
