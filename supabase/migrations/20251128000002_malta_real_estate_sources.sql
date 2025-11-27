BEGIN;

CREATE TABLE IF NOT EXISTS public.real_estate_sources (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code text NOT NULL,
  source_name text NOT NULL,
  url text NOT NULL UNIQUE,
  crawl_strategy text DEFAULT 'openai_web_search',
  crawl_frequency_hours integer DEFAULT 24,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.real_estate_sources ENABLE ROW LEVEL SECURITY;

-- Seed Malta Real Estate Sources
INSERT INTO public.real_estate_sources (source_name, url, country_code, crawl_strategy) VALUES
('Frank Salt Real Estate', 'https://franksalt.com.mt', 'MT', 'openai_web_search'),
('Dhalia Real Estate', 'https://www.dhalia.com', 'MT', 'openai_web_search'),
('QuickLets', 'https://www.quicklets.com.mt', 'MT', 'openai_web_search'),
('Zanzi Homes', 'https://www.zanzihomes.com', 'MT', 'openai_web_search'),
('Perry Estate Agents', 'https://www.perry.com.mt', 'MT', 'openai_web_search'),
('Simon Mamo Real Estate', 'https://www.simonmamo.com', 'MT', 'openai_web_search'),
('Sara Grech', 'https://www.saragrech.com', 'MT', 'openai_web_search'),
('Belair Property', 'https://belair.com.mt', 'MT', 'openai_web_search'),
('Alliance Real Estate', 'https://alliance.mt', 'MT', 'openai_web_search'),
('Century 21 Malta', 'https://www.century21.mt', 'MT', 'openai_web_search'),
('RE/MAX Malta', 'https://remax-malta.com', 'MT', 'openai_web_search'),
('Excel Homes', 'https://excel.com.mt', 'MT', 'openai_web_search'),
('Benestates', 'https://www.benestates.com', 'MT', 'openai_web_search'),
('Chestertons Malta', 'https://www.chestertons.com.mt', 'MT', 'openai_web_search'),
('Engel & Völkers Malta', 'https://www.engelvoelkers.com/en-mt/malta', 'MT', 'openai_web_search'),
('Maltapark Property', 'https://www.maltapark.com/property', 'MT', 'openai_web_search')
ON CONFLICT (url) DO UPDATE SET 
crawl_strategy = EXCLUDED.crawl_strategy,
country_code = EXCLUDED.country_code;

COMMIT;
