-- Add flexible country matching helper for international expansion
-- Supports both full country names (Rwanda, Malta) and ISO codes (RW, MT)
-- =========================================================================================
BEGIN;

-- Create helper function for flexible country matching
CREATE OR REPLACE FUNCTION public.country_matches(
  business_country text,
  search_country text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- If either is NULL, no match
  IF business_country IS NULL OR search_country IS NULL THEN
    RETURN false;
  END IF;
  
  -- Normalize both to uppercase for comparison
  business_country := UPPER(TRIM(business_country));
  search_country := UPPER(TRIM(search_country));
  
  -- Direct match
  IF business_country = search_country THEN
    RETURN true;
  END IF;
  
  -- Check common country code mappings
  -- Rwanda
  IF (business_country = 'RWANDA' AND search_country = 'RW') OR
     (business_country = 'RW' AND search_country = 'RWANDA') THEN
    RETURN true;
  END IF;
  
  -- Malta
  IF (business_country = 'MALTA' AND search_country = 'MT') OR
     (business_country = 'MT' AND search_country = 'MALTA') THEN
    RETURN true;
  END IF;
  
  -- Kenya
  IF (business_country = 'KENYA' AND search_country = 'KE') OR
     (business_country = 'KE' AND search_country = 'KENYA') THEN
    RETURN true;
  END IF;
  
  -- Uganda
  IF (business_country = 'UGANDA' AND search_country = 'UG') OR
     (business_country = 'UG' AND search_country = 'UGANDA') THEN
    RETURN true;
  END IF;
  
  -- Tanzania
  IF (business_country = 'TANZANIA' AND search_country = 'TZ') OR
     (business_country = 'TZ' AND search_country = 'TANZANIA') THEN
    RETURN true;
  END IF;
  
  -- Burundi
  IF (business_country = 'BURUNDI' AND search_country = 'BI') OR
     (business_country = 'BI' AND search_country = 'BURUNDI') THEN
    RETURN true;
  END IF;
  
  -- Democratic Republic of Congo
  IF (business_country IN ('DEMOCRATIC REPUBLIC OF CONGO', 'DR CONGO', 'DRC', 'CONGO-KINSHASA') AND search_country IN ('CD', 'COD')) OR
     (search_country IN ('DEMOCRATIC REPUBLIC OF CONGO', 'DR CONGO', 'DRC', 'CONGO-KINSHASA') AND business_country IN ('CD', 'COD')) THEN
    RETURN true;
  END IF;
  
  -- Republic of Congo
  IF (business_country IN ('REPUBLIC OF CONGO', 'CONGO-BRAZZAVILLE') AND search_country IN ('CG', 'COG')) OR
     (search_country IN ('REPUBLIC OF CONGO', 'CONGO-BRAZZAVILLE') AND business_country IN ('CG', 'COG')) THEN
    RETURN true;
  END IF;
  
  -- South Africa
  IF (business_country = 'SOUTH AFRICA' AND search_country = 'ZA') OR
     (business_country = 'ZA' AND search_country = 'SOUTH AFRICA') THEN
    RETURN true;
  END IF;
  
  -- Nigeria
  IF (business_country = 'NIGERIA' AND search_country = 'NG') OR
     (business_country = 'NG' AND search_country = 'NIGERIA') THEN
    RETURN true;
  END IF;
  
  -- Ghana
  IF (business_country = 'GHANA' AND search_country = 'GH') OR
     (business_country = 'GH' AND search_country = 'GHANA') THEN
    RETURN true;
  END IF;
  
  -- Ethiopia
  IF (business_country = 'ETHIOPIA' AND search_country = 'ET') OR
     (business_country = 'ET' AND search_country = 'ETHIOPIA') THEN
    RETURN true;
  END IF;
  
  -- Add more countries as platform expands
  
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.country_matches IS 
'Flexible country matching supporting both full names (Rwanda, Malta) and ISO codes (RW, MT). 
Case-insensitive and handles variations. Used for future international expansion.';

-- Create index on country for faster filtering if needed
CREATE INDEX IF NOT EXISTS idx_business_country_active 
ON business(country) 
WHERE is_active = true;

SELECT 'Country matching helper created - supports RW/Rwanda, MT/Malta, etc.' AS status;

COMMIT;
