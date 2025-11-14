-- =====================================================
-- PHASE 1: CREATE BARS TABLE AND POPULATE DATA
-- Migration: 20251112170000_phase1_bars_table.sql
-- =====================================================

BEGIN;

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create the 'bars' table with geography support
CREATE TABLE IF NOT EXISTS public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    location_text text,
    country text,
    city_area text,
    currency text,
    momo_code text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- 2. Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bars_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bars_updated_at ON public.bars;
CREATE TRIGGER set_bars_updated_at 
  BEFORE UPDATE ON public.bars 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_bars_updated_at();

-- 3. Insert first 100 bars data
INSERT INTO public.bars (name, location_text, country, city_area, currency, slug)
VALUES
  ('Paranga', 'Paranga, InterContinental Beach Club, InterContinental Malta, St. George''s Bay, St Julian''s STJ 3310, Malta', 'Malta', 'St Julian''s', 'EUR', 'paranga'),
  ('Le Bistro', 'Radisson Blu Resort, St. Julian''s, St Julian''s STJ 3391, Malta', 'Malta', 'St Julian''s', 'EUR', 'le-bistro'),
  ('Bahamas Pub', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bahamas-pub'),
  ('Seaside Kiosk', 'Triq It - Trunciera, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'seaside-kiosk'),
  ('Felice Brasserie', 'Triq Ix - Xatt, Tas-Sliema SLM 1171, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'felice-brasserie'),
  ('Little Argentina', '210, Tower Road Sliema, Tas-Sliema SLM 1602, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'little-argentina'),
  ('Caviar & Bull', 'Corinthia Hotel St. George''s Bay San Ġiljan, St Julian''s STJ 3301, Malta', 'Malta', 'St Julian''s', 'EUR', 'caviar-bull'),
  ('Inzozi Africa House B&B', '15 KG 3 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'inzozi-africa-house-bb'),
  ('Intercontinental Beach Bar', 'St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'intercontinental-beach-bar'),
  ('Paul''s Bistro', '91 Triq San Gwann Il-Belt Valletta, Il-Belt Valletta VLT 1165, Malta', 'Malta', 'Valletta', 'EUR', 'pauls-bistro'),
  ('The SkySports Lounge', 'KG 218 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-skysports-lounge'),
  ('Malta Chocolate Factory', '179 Triq Sant'' Antnin Street, San Pawl il-Baħar SPB 2658, Malta', 'Malта', 'San Pawl il-Baħar', 'EUR', 'malta-chocolate-factory'),
  ('Peppi''s Restaurant', 'Tower Road, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'peppis-restaurant'),
  ('Tavio''s Pepe Nero', 'Trejqet il-Veccja San Pawl il-Baħar, San Pawl il-Baħar SPB 3630, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'tavios-pepe-nero'),
  ('The Green Lounge Bar & Restaurant', 'Kicukiro Sonatube, SilverBack Mall Rooftop, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-green-lounge-bar-restaurant'),
  ('Tiffany Lounge Restaurant', 'Portomaso Marina, Level -3, St. Julians, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'tiffany-lounge-restaurant'),
  ('Hugo''s Terrace & Rooftop', 'Triq Dragunara, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'hugos-terrace-rooftop'),
  ('Barracuda Restaurant', '194 Main Street, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'barracuda-restaurant'),
  ('Exiles', 'Exiles Bay, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'exiles'),
  ('B Flex Bar', '11 KK 21 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'b-flex-bar'),
  ('Barracuda Rooftop Lounge', 'Barracuda Building, 16 Triq Censu Tabone, Ballluta Bay, St Julian''s STJ1218, Malta', 'Malta', 'St Julian''s', 'EUR', 'barracuda-rooftop-lounge'),
  ('Riders Lounge Kigali', 'KG 7 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'riders-lounge-kigali'),
  ('The Brigantine Lounge Bar', 'Ramla Bay Resort, Triq Ir-Ramla, Mellieħa MLH 7100, Malta', 'Malta', 'Mellieħa', 'EUR', 'the-brigantine-lounge-bar'),
  ('Henry J. Bean''s', 'ix-Xatt Ta'' San Ġorġ, San Ġiljan STJ3301, Malta', 'Malta', 'San Ġiljan', 'EUR', 'henry-j-beans'),
  ('Kigali Diplomat Hotel', '2 KG 566 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'kigali-diplomat-hotel'),
  ('Vecchia Napoli @ Salini Resort. Naxxar', 'Triq Is-Salini Naxxar, In-Naxxar NXR 9030, Malta', 'Malta', 'Naxxar', 'EUR', 'vecchia-napoli-salini-resort-naxxar'),
  ('Sakura Japanese Cuisine Lounge', 'Triq Paceville, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'sakura-japanese-cuisine-lounge'),
  ('Cork''s', '58 Triq San Gorg, St Julian''s STJ 3205, Malta', 'Malta', 'St Julian''s', 'EUR', 'corks'),
  ('HAVANA BAR AND RESTO', '3322+G97, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'havana-bar-and-resto'),
  ('Cocobean', 'KG 5 Ave, A, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'cocobean'),
  ('Jollof Kigali', 'KG 18 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'jollof-kigali'),
  ('Hôtel Chez Lando', 'KG 201 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'hotel-chez-lando'),
  ('Peperino Pizza Cucina Verace', NULL, 'Malta', NULL, 'EUR', 'peperino-pizza-cucina-verace'),
  ('Tropical Bar-Restaurant-Rounge', '4 KK 371 St, Kigali, Rwanda', 'Malta', 'Kigali', 'EUR', 'tropical-bar-restaurant-rounge'),
  ('Hotel Villa Portofino Kigali', 'House No. 119, KG 9 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'hotel-villa-portofino-kigali'),
  ('Roasters CHOMAZONE Restaurant', 'KK 6 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'roasters-chomazone-restaurant'),
  ('Meze Fresh', 'KG 550 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'meze-fresh'),
  ('Exiles', NULL, 'Malta', NULL, 'EUR', 'exiles-2'),
  ('Sandy Waters', 'X8CX+CRX, Triq Il-Marfa, Il-Mellieħa, Malta', 'Malta', 'Mellieħa', 'EUR', 'sandy-waters'),
  ('Xemxija Pitstop', 'Xatt Il-Pwales, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'xemxija-pitstop'),
  ('Victoria Gastropub', 'Islet Promanade, St Paul''s Bay, Malta', 'Malta', 'St Paul''s Bay', 'EUR', 'victoria-gastropub'),
  ('Bar Nyenyeri', 'KK 31 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'bar-nyenyeri'),
  ('Paddock Bar', 'KK 367 #2, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'paddock-bar'),
  ('Medasia Fusion Lounge', 'Paceville, St. Julian''s, Malta', 'Malta', 'Paceville', 'EUR', 'medasia-fusion-lounge'),
  ('Bus Stop Lounge', NULL, 'Malta', NULL, 'EUR', 'bus-stop-lounge'),
  ('White Wine And Food', 'St. George''s Bay San Ġiljan, St Julian''s STJ 3302, Malta', 'Malta', 'St Julian''s', 'EUR', 'white-wine-and-food'),
  ('La Sanitas', 'KK 341 St, #20, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'la-sanitas'),
  ('Sharma Ethnic Cuisines', '52 Villa Rosa, Is-Swieqi SWQ 3344, Malta', 'Malta', 'Swieqi', 'EUR', 'sharma-ethnic-cuisines'),
  ('Doma Marsascala', NULL, 'Malta', NULL, 'EUR', 'doma-marsascala'),
  ('The Grid Kigali', 'Kigali Business Centre, KN 5 Rd, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'the-grid-kigali'),
  ('Open Waters', 'WFGQ+44X, ix-Xatt Ta'' San Ġorġ, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'open-waters'),
  ('CKYC Lounge', 'KN 196 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'ckyc-lounge'),
  ('Cuba Campus Hub', 'University Campus, Msida, Malta', 'Malta', 'Msida', 'EUR', 'cuba-campus-hub'),
  ('Chez Guiness Bar', '24VC+93P, KG 129 St, Kigali, Rwanda', 'Malta', 'Kigali', 'EUR', 'chez-guiness-bar'),
  ('Bayside Restaurant', 'Dawret Il-Gzejjer, San Pawl il-Baħar, Malta', 'Malta', 'San Pawl il-Baħar', 'EUR', 'bayside-restaurant'),
  ('L'' Ostricaio Paceville. St. Julians', 'Triq Ball, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'l-ostricaio-paceville-st-julians'),
  ('Kigali Marriott Hotel', 'KN 3 Ave, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'kigali-marriott-hotel'),
  ('Marina Terrace', 'Marina Terrace, Portamaso Marina, St Julian''s PTM01, Malta', 'Malta', 'St Julian''s', 'EUR', 'marina-terrace'),
  ('Agence Pub', '24Q7+MH3, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'agence-pub'),
  ('Cuba Shoreline', NULL, 'Malta', NULL, 'EUR', 'cuba-shoreline'),
  ('House of Flavors', 'Paceville, St. Julian''s, Malta', 'Malta', 'Paceville', 'EUR', 'house-of-flavors'),
  ('NOM NOM Paceville', 'Triq id-Dragunara, San Ġiljan, Malta', 'Malta', 'San Ġiljan', 'EUR', 'nom-nom-paceville'),
  ('HQ LOUNGE', 'KK 15 RD AND, KK 22 AVE, JUNCTION, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'hq-lounge'),
  ('Okurama Asian Fusion', NULL, 'Malta', NULL, 'EUR', 'okurama-asian-fusion'),
  ('Trattoria da Nennella', '76 St George''s Road St Julian''s, St Julian''s STJ 3205, Malta', 'Malta', 'St Julian''s', 'EUR', 'trattoria-da-nennella'),
  ('The Londoner British Pub Sliema', NULL, 'Malta', NULL, 'EUR', 'the-londoner-british-pub-sliema'),
  ('Maracana Rwanda', 'KK 698 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'maracana-rwanda'),
  ('Great Wall Chinese Restaurant', '3 KG 624 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'great-wall-chinese-restaurant'),
  ('Era Ora Steakhouse', 'Barracuda Building, Balluta Bay, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'era-ora-steakhouse'),
  ('The Capitol City Bar', '172 Merchants St, Valletta VLT 1462, Malta', 'Malta', 'Valletta', 'EUR', 'the-capitol-city-bar'),
  ('Déjà Vu', '13 KG 169 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'deja-vu'),
  ('Peppermint', 'WFFQ+FVH, Triq il-Wilga, St Julian''s, Malta', 'Malta', 'St Julian''s', 'EUR', 'peppermint'),
  ('La Pira Maltese Kitchen', '35 Merchants St, Valletta VLT 1171, Malta', 'Malta', 'Valletta', 'EUR', 'la-pira-maltese-kitchen'),
  ('CARRINGTON Resto-Bar', '24W6+7JJ, KG 233 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'carrington-resto-bar'),
  ('Surfside', NULL, 'Malta', NULL, 'EUR', 'surfside'),
  ('Cuba Campus Hub', NULL, 'Malta', NULL, 'EUR', 'cuba-campus-hub-2'),
  ('Cincinnati Bar & Grill', '2 KK 341 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'cincinnati-bar-grill'),
  ('Lemigo Hotel', 'KG 624 St, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'lemigo-hotel'),
  ('Lou's Bistro', 'Tigné Seafront, Tas-Sliema, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'lous-bistro'),
  ('Opa! Mediterranean Fusion', '163 Triq Ix - Xatt, Tas-Sliema, Malta', 'Malta', 'Tas-Sliema', 'EUR', 'opa-mediterranean-fusion'),
  ('Mojitos Beach Terrace', 'Triq Ir-Ramla, Il-Mellieħa MLH 7100, Malta', 'Malta', 'Mellieħa', 'EUR', 'mojitos-beach-terrace'),
  ('Gourmet Bar & Grill', '114 Gourmet Bar&Grill TRIQ IL-HGEJJEG BUGIBBA, SAN PAWL IL-BAHAR Saint Paul''s Bay, St Paul''s Bay SPB 2821, Malta', 'Malta', 'St Paul''s Bay', 'EUR', 'gourmet-bar-grill'),
  ('Okurama Asian Fusion', 'St. George''s Bay, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'okurama-asian-fusion-2'),
  ('Suki Asian Snacks', 'Republic St, Valletta VLT 1117, Malta', 'Malta', 'Valletta', 'EUR', 'suki-asian-snacks'),
  ('San Giovanni Valletta', 'St. John''s Square Valletta, Il-Belt Valletta VLT 1150, Malta', 'Malta', 'Valletta', 'EUR', 'san-giovanni-valletta'),
  ('Grand Legacy Hotel', '24Q7+6J, KN 3 Rd, Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'grand-legacy-hotel'),
  ('The Bridge Bar', 'VGW7+FCP, Liesse, Il-Belt Valletta, Malta', 'Malta', 'Valletta', 'EUR', 'the-bridge-bar'),
  ('The Brew Bar Grill', 'Triq Paceville, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'the-brew-bar-grill'),
  ('1926 La Vie', 'Qui-Si-Sana Seafront Sliema SLM, Sliema 3503, Malta', 'Malta', 'Sliema', 'EUR', '1926-la-vie'),
  ('Dolce Sicilia Paceville', 'STJ3141 Triq Dragonara,nr 89, St Julian''s STJ 3141, Malta', 'Malta', 'St Julian''s', 'EUR', 'dolce-sicilia-paceville'),
  ('CUBA Restaurant. Shoreline Mall. Kalkara', 'The Shoreline Mall, Smart City, Kalkara SCM 1001, Malta', 'Malta', 'Kalkara', 'EUR', 'cuba-restaurant-shoreline-mall-kalkara'),
  ('The Londoner British Pub Sliema', 'Triq ix-Xatt, Sliema, Malta', 'Malta', 'Sliema', 'EUR', 'the-londoner-british-pub-sliema-2'),
  ('The Hatter Irish Pub', '34 Triq Gerry Zammit, Il-Gżira GZR 1660, Malta', 'Malta', 'Gżira', 'EUR', 'the-hatter-irish-pub'),
  ('Maxima Bar & Restaurant', 'Maxima, Marfa Road, Mellieħa, Malta', 'Malta', 'Mellieħa', 'EUR', 'maxima-bar-restaurant'),
  ('Ventuno Restaurant', 'Marfa Road, Mellieħa, Malta', 'Malta', 'Mellieħa', 'EUR', 'ventuno-restaurant'),
  ('9 Ball Cafe', '366 Tourist St, St Paul''s Bay, Malta', 'Malta', 'St Paul''s Bay', 'EUR', '9-ball-cafe'),
  ('White Tower Lido', 'Il-Bajja ta Torri L Abjad, Mellieħa, Malta', 'Malta', 'Mellieħa', 'EUR', 'white-tower-lido'),
  ('Cafe Cuba St Julians', 'St. George''s Bay, St. Julian''s, Malta', 'Malta', 'St. Julian''s', 'EUR', 'cafe-cuba-st-julians'),
  ('Burrows Bar & Restaurant', 'Kigali, Rwanda', 'Rwanda', 'Kigali', 'RWF', 'burrows-bar-restaurant')
ON CONFLICT (slug) DO NOTHING;

-- 4. Enable RLS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY "bars_select_all" ON public.bars
  FOR SELECT USING (true);

CREATE POLICY "bars_service_role_all" ON public.bars
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
