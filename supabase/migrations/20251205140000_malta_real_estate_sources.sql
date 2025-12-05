-- ============================================================================
-- Malta Real Estate Sources - Comprehensive List
-- All major Malta property websites for Deep Search
-- ============================================================================

-- Insert Malta real estate sources (ON CONFLICT to avoid duplicates)
insert into real_estate_sources (name, url, country, source_type, property_types, coverage_areas, priority, notes) values
  -- Marketplaces / Direct
  ('Maltapark Property', 'https://maltapark.com/listings/property', 'MT', 'classifieds', '{"apartment", "house", "commercial", "land"}', '{"Malta", "Gozo"}', 95, '#1 Classifieds site. Best for Direct from Owner deals.'),
  ('Facebook Marketplace Malta', 'https://facebook.com/marketplace/malta', 'MT', 'classifieds', '{"apartment", "house"}', '{"Malta", "Gozo"}', 90, 'High volume of rentals. Filter by Malta location.'),
  ('No Agent Fees Malta', 'https://noagentfeesmalta.com', 'MT', 'classifieds', '{"apartment", "house"}', '{"Malta", "Gozo"}', 85, 'Platform strictly for listing without agent commissions.'),
  
  -- Major Agencies - Rentals
  ('QuickLets', 'https://quicklets.com.mt', 'MT', 'agency', '{"apartment", "house"}', '{"Malta", "Gozo"}', 95, 'Largest database for residential rentals (Long Let).'),
  ('Zanzi Homes', 'https://zanzihomes.com', 'MT', 'agency', '{"apartment", "house", "villa"}', '{"Malta", "Gozo"}', 90, 'Sister company to QuickLets. Sales only.'),
  
  -- Major Agencies - General
  ('Frank Salt', 'https://franksalt.com.mt', 'MT', 'agency', '{"apartment", "house", "villa", "commercial"}', '{"Malta", "Gozo"}', 92, 'Oldest, most established agency. Sales & Letting.'),
  ('RE/MAX Malta', 'https://remax-malta.com', 'MT', 'agency', '{"apartment", "house", "villa", "commercial"}', '{"Malta", "Gozo"}', 92, 'Largest agent network. High volume of listings.'),
  ('Dhalia', 'https://dhalia.com', 'MT', 'agency', '{"apartment", "house", "commercial"}', '{"Malta", "Gozo"}', 88, 'Strong local network, residential & commercial.'),
  ('Simon Mamo', 'https://simonmamo.com', 'MT', 'agency', '{"apartment", "house"}', '{"Malta", "Gozo"}', 85, 'Good for budget-friendly rentals and older properties.'),
  ('Alliance', 'https://alliance.mt', 'MT', 'agency', '{"apartment", "house", "commercial"}', '{"Malta", "Gozo"}', 85, 'Fast-growing network. Sales & Letting.'),
  ('Century 21 Malta', 'https://century21.mt', 'MT', 'agency', '{"apartment", "house", "commercial"}', '{"Malta", "Gozo"}', 85, 'International brand with strong local franchises.'),
  ('Ben Estates', 'https://benestates.com', 'MT', 'agency', '{"apartment", "house"}', '{"Malta"}', 80, 'Focus on modern finishing and lifestyle properties.'),
  ('Excel Homes', 'https://excel.com.mt', 'MT', 'agency', '{"house", "villa", "character"}', '{"Malta", "Gozo"}', 80, 'Focus on character homes and quality sales.'),
  
  -- Premium / Luxury Agencies
  ('Belair Property', 'https://belair.com.mt', 'MT', 'agency', '{"apartment", "villa", "penthouse"}', '{"Sliema", "St Julians", "Paceville"}', 88, 'Specialists in Sliema, St. Julians & Lifestyle areas.'),
  ('Perry Estate Agents', 'https://perry.com.mt', 'MT', 'agency', '{"apartment", "villa", "commercial"}', '{"Malta"}', 85, 'High-end residential & commercial portfolios.'),
  ('Malta Sothebys Realty', 'https://maltasothebysrealty.com', 'MT', 'agency', '{"villa", "penthouse", "luxury"}', '{"Malta", "Gozo"}', 90, 'Luxury investments, SDAs, and high-value villas.'),
  ('Engel & Völkers Malta', 'https://evmalta.com', 'MT', 'agency', '{"villa", "penthouse", "luxury", "yacht"}', '{"Malta", "Gozo"}', 90, 'Premium real estate and yachting.'),
  
  -- Commercial Specialists
  ('QLC Commercial', 'https://qlc.com.mt', 'MT', 'agency', '{"office", "retail", "catering"}', '{"Malta"}', 90, 'Dedicated strictly to Offices, Retail & Catering.'),
  ('Office Market', 'https://officemarket.mt', 'MT', 'agency', '{"office"}', '{"Malta"}', 88, 'Specialists in offices for iGaming & Finance sectors.'),
  ('Commercial RE Malta', 'https://commercialrealestatemalta.com', 'MT', 'agency', '{"office", "warehouse", "industrial", "retail"}', '{"Malta"}', 85, 'Broad database including warehouses/industrial.'),
  
  -- Short Let / Holiday
  ('Airbnb Malta', 'https://airbnb.com/malta/stays', 'MT', 'portal', '{"apartment", "house", "villa"}', '{"Malta", "Gozo"}', 92, 'Global platform. Best for holiday/short stays.'),
  ('Booking.com Apartments', 'https://booking.com/apartments/country/mt', 'MT', 'portal', '{"apartment", "hotel"}', '{"Malta", "Gozo"}', 90, 'Best for holiday apartments and hotel alternatives.'),
  ('Holiday Malta', 'https://holiday-malta.com', 'MT', 'portal', '{"villa", "farmhouse"}', '{"Malta", "Gozo"}', 85, 'Local specialist for Villas with pools & Farmhouses.'),
  ('Short Lets Malta', 'https://shortletsmalta.com', 'MT', 'portal', '{"apartment"}', '{"Malta"}', 82, 'Managed apartments for tourists.'),
  ('Flatio Malta', 'https://flatio.com/malta', 'MT', 'portal', '{"apartment"}', '{"Malta"}', 80, '1-6 month rentals. Ideal for Digital Nomads.'),
  
  -- Gozo Specialists
  ('Gozo Prime', 'https://gozoprime.com', 'MT', 'agency', '{"apartment", "house", "farmhouse", "villa"}', '{"Gozo"}', 88, 'Dedicated agency for property on Gozo island.'),
  ('Move 2 Gozo', 'https://move2gozo.com', 'MT', 'agency', '{"apartment", "house", "farmhouse"}', '{"Gozo"}', 85, 'Sales and letting specifically for Gozo expats.'),
  
  -- Aggregator / Data
  ('Property Market Malta', 'https://propertymarket.com.mt', 'MT', 'portal', '{"apartment", "house", "commercial"}', '{"Malta", "Gozo"}', 80, 'Listings plus market price statistics and trends.')
  
on conflict (url) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  property_types = excluded.property_types,
  coverage_areas = excluded.coverage_areas,
  priority = excluded.priority,
  notes = excluded.notes,
  updated_at = now();

-- Social Groups (special handling - may need different crawl approach)
-- These are noted but may require different integration
comment on table real_estate_sources is 'Dynamic list of real estate websites for Deep Search. Includes FB groups: facebook.com/groups/maltaproperty and facebook.com/groups/directfromownermalta';
