-- =====================================================
-- ENHANCE JOB LISTINGS WITH COMPREHENSIVE CONTACT INFO
-- =====================================================
-- Adds email, social media, and contact validation
-- Ensures jobs from external sources have contact info
-- =====================================================

BEGIN;

-- Add new contact fields to job_listings
ALTER TABLE job_listings
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_whatsapp text,
  ADD COLUMN IF NOT EXISTS contact_linkedin text,
  ADD COLUMN IF NOT EXISTS contact_facebook text,
  ADD COLUMN IF NOT EXISTS contact_twitter text,
  ADD COLUMN IF NOT EXISTS contact_website text,
  ADD COLUMN IF NOT EXISTS contact_other jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS has_contact_info boolean GENERATED ALWAYS AS (
    contact_phone IS NOT NULL OR 
    contact_email IS NOT NULL OR 
    contact_whatsapp IS NOT NULL OR 
    contact_linkedin IS NOT NULL OR 
    external_url IS NOT NULL
  ) STORED;

-- Add external_url if not exists (for scraped jobs)
ALTER TABLE job_listings
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES job_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_external boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS job_hash text,
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Create unique index on job_hash for external jobs
CREATE UNIQUE INDEX IF NOT EXISTS job_listings_hash_uniq 
  ON job_listings(job_hash) 
  WHERE job_hash IS NOT NULL AND is_external = true;

-- Add index on contact availability
CREATE INDEX IF NOT EXISTS job_listings_has_contact_idx 
  ON job_listings(has_contact_info) 
  WHERE is_external = true;

-- Add index on company name for search
CREATE INDEX IF NOT EXISTS job_listings_company_idx 
  ON job_listings(company_name) 
  WHERE company_name IS NOT NULL;

-- Add index on external URL
CREATE INDEX IF NOT EXISTS job_listings_external_url_idx 
  ON job_listings(external_url) 
  WHERE external_url IS NOT NULL;

-- Function to normalize phone numbers (similar to property scraping)
CREATE OR REPLACE FUNCTION normalize_job_contact_phone(
  phone text,
  country text DEFAULT 'Rwanda'
) RETURNS text AS $$
DECLARE
  cleaned text;
  country_code text;
BEGIN
  -- Return NULL if no phone
  IF phone IS NULL OR trim(phone) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove all non-digit characters
  cleaned := regexp_replace(phone, '[^0-9+]', '', 'g');
  
  -- Map country to code
  country_code := CASE 
    WHEN country IN ('Rwanda', 'RW', 'rw') THEN '+250'
    WHEN country IN ('Malta', 'MT', 'mt') THEN '+356'
    WHEN country IN ('Kenya', 'KE', 'ke') THEN '+254'
    WHEN country IN ('Uganda', 'UG', 'ug') THEN '+256'
    WHEN country IN ('Tanzania', 'TZ', 'tz') THEN '+255'
    ELSE '+250' -- Default to Rwanda
  END;
  
  -- If already has +, validate length
  IF cleaned LIKE '+%' THEN
    IF length(cleaned) >= 10 AND length(cleaned) <= 15 THEN
      RETURN cleaned;
    ELSE
      RETURN NULL;
    END IF;
  END IF;
  
  -- If starts with country code without +, add it
  IF cleaned LIKE '250%' OR cleaned LIKE '356%' OR cleaned LIKE '254%' OR 
     cleaned LIKE '256%' OR cleaned LIKE '255%' THEN
    cleaned := '+' || cleaned;
    IF length(cleaned) >= 10 AND length(cleaned) <= 15 THEN
      RETURN cleaned;
    END IF;
  END IF;
  
  -- If starts with 0, replace with country code
  IF cleaned LIKE '0%' THEN
    cleaned := country_code || substring(cleaned from 2);
    IF length(cleaned) >= 10 AND length(cleaned) <= 15 THEN
      RETURN cleaned;
    END IF;
  END IF;
  
  -- If just digits without country code, add it
  IF length(cleaned) >= 9 AND length(cleaned) <= 10 THEN
    cleaned := country_code || cleaned;
    RETURN cleaned;
  END IF;
  
  -- Invalid format
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract contact info from job description/metadata
CREATE OR REPLACE FUNCTION extract_job_contact_info(
  description text,
  metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  email_pattern text := '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';
  phone_pattern text := '(\+?\d{1,4}[\s-]?)?(\(?\d{1,4}\)?[\s-]?)?[\d\s-]{7,15}';
  whatsapp_pattern text := '(whatsapp|wa)[:\s]+(\+?\d{10,15})';
BEGIN
  -- Extract email
  IF description ~ email_pattern THEN
    result := jsonb_set(result, '{email}', 
      to_jsonb((regexp_matches(description, email_pattern, 'i'))[1])
    );
  END IF;
  
  -- Extract phone (basic pattern)
  IF description ~ phone_pattern THEN
    result := jsonb_set(result, '{phone}', 
      to_jsonb((regexp_matches(description, phone_pattern, 'i'))[1])
    );
  END IF;
  
  -- Extract WhatsApp
  IF description ~* whatsapp_pattern THEN
    result := jsonb_set(result, '{whatsapp}', 
      to_jsonb((regexp_matches(description, whatsapp_pattern, 'i'))[2])
    );
  END IF;
  
  -- Extract LinkedIn (URL pattern)
  IF description ~* 'linkedin\.com/in/[\w-]+' THEN
    result := jsonb_set(result, '{linkedin}', 
      to_jsonb((regexp_matches(description, 'linkedin\.com/in/([\w-]+)', 'i'))[1])
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update function to validate job postings have some contact method
CREATE OR REPLACE FUNCTION validate_job_contact_info()
RETURNS TRIGGER AS $$
BEGIN
  -- For external jobs, at least one contact method or external_url must be present
  IF NEW.is_external = true THEN
    IF NEW.contact_phone IS NULL AND 
       NEW.contact_email IS NULL AND 
       NEW.contact_whatsapp IS NULL AND 
       NEW.contact_linkedin IS NULL AND
       NEW.external_url IS NULL THEN
      RAISE EXCEPTION 'External jobs must have at least one contact method or external URL';
    END IF;
  END IF;
  
  -- Normalize phone numbers if present
  IF NEW.contact_phone IS NOT NULL THEN
    NEW.contact_phone := normalize_job_contact_phone(NEW.contact_phone, 'Rwanda');
  END IF;
  
  IF NEW.contact_whatsapp IS NOT NULL THEN
    NEW.contact_whatsapp := normalize_job_contact_phone(NEW.contact_whatsapp, 'Rwanda');
  END IF;
  
  -- Update last_seen_at for external jobs
  IF NEW.is_external = true AND OLD.id IS NOT NULL THEN
    NEW.last_seen_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contact validation
DROP TRIGGER IF EXISTS job_listings_validate_contact ON job_listings;
DROP TRIGGER IF EXISTS job_listings_validate_contact ON job_listings;
CREATE TRIGGER job_listings_validate_contact
  BEFORE INSERT OR UPDATE ON job_listings
  FOR EACH ROW
  EXECUTE FUNCTION validate_job_contact_info();

-- View to show jobs with full contact info
CREATE OR REPLACE VIEW job_listings_with_contacts AS
SELECT 
  jl.*,
  CASE 
    WHEN jl.contact_whatsapp IS NOT NULL THEN jl.contact_whatsapp
    WHEN jl.contact_phone IS NOT NULL THEN jl.contact_phone
    ELSE NULL 
  END as primary_phone,
  CASE
    WHEN jl.contact_whatsapp IS NOT NULL THEN 'WhatsApp: ' || jl.contact_whatsapp
    WHEN jl.contact_phone IS NOT NULL THEN 'Phone: ' || jl.contact_phone
    WHEN jl.contact_email IS NOT NULL THEN 'Email: ' || jl.contact_email
    WHEN jl.contact_linkedin IS NOT NULL THEN 'LinkedIn: ' || jl.contact_linkedin
    WHEN jl.external_url IS NOT NULL THEN 'Apply: ' || jl.external_url
    ELSE 'Contact via poster'
  END as contact_display,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN jl.contact_phone IS NOT NULL THEN 'phone' END,
    CASE WHEN jl.contact_email IS NOT NULL THEN 'email' END,
    CASE WHEN jl.contact_whatsapp IS NOT NULL THEN 'whatsapp' END,
    CASE WHEN jl.contact_linkedin IS NOT NULL THEN 'linkedin' END,
    CASE WHEN jl.contact_facebook IS NOT NULL THEN 'facebook' END,
    CASE WHEN jl.external_url IS NOT NULL THEN 'website' END
  ], NULL) as available_contact_methods
FROM job_listings jl;

-- Grant access
GRANT SELECT ON job_listings_with_contacts TO anon, authenticated;

COMMIT;
