-- =====================================================================
-- RIDES & INSURANCE AGENTS - SCHEMA EXTENSION
-- =====================================================================
-- Migration: Add Rides and Insurance agents with domain tables
-- Created: 2025-11-21
-- Description: Extends AI agent ecosystem with Rides (drivers/passengers/trips)
--              and Insurance (documents/quotes/renewals) agents.
--              All workflows are WhatsApp-first, natural language driven.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. RIDES DOMAIN TABLES (WhatsApp-First, Natural Language)
-- =====================================================================

-- Rides: Saved Locations
CREATE TABLE IF NOT EXISTS public.rides_saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  label text NOT NULL,
  address_text text NOT NULL,
  lat double precision,
  lng double precision,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.rides_saved_locations IS 
'Named addresses per WhatsApp user (Home, Work, Favourite bar, etc.) used by Rides agent to quickly build trips.';

-- Rides: Trips
CREATE TABLE IF NOT EXISTS public.rides_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  driver_user_id uuid REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status text DEFAULT 'pending',
  price_estimate numeric,
  currency text DEFAULT 'RWF',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.rides_trips IS 
'Trips scheduled or completed between drivers and passengers. Created/updated from Rides agent intents.';

COMMENT ON COLUMN public.rides_trips.status IS 
'Trip status: pending, matched, en_route, completed, cancelled';

COMMENT ON COLUMN public.rides_trips.scheduled_at IS 
'NULL for immediate rides, timestamp for scheduled trips';

-- Rides: Driver Status
CREATE TABLE IF NOT EXISTS public.rides_driver_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  is_online boolean DEFAULT false,
  current_lat double precision,
  current_lng double precision,
  last_seen_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

COMMENT ON TABLE public.rides_driver_status IS 
'Lightweight status/availability for drivers. Updated from natural language ("I''m online", "I''m off").';

-- =====================================================================
-- 2. INSURANCE DOMAIN TABLES (WhatsApp-First, Natural Language)
-- =====================================================================

-- Insurance: Profiles
CREATE TABLE IF NOT EXISTS public.insurance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  vehicle_identifier text,
  vehicle_metadata jsonb DEFAULT '{}'::jsonb,
  owner_name text,
  owner_id_number text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.insurance_profiles IS 
'Per-user and per-vehicle insurance profile created from chat when Insurance agent asks questions and parses answers.';

COMMENT ON COLUMN public.insurance_profiles.vehicle_metadata IS 
'Make, model, year, etc. as JSON: {"make": "Toyota", "model": "RAV4", "year": 2020}';

-- Insurance: Documents
CREATE TABLE IF NOT EXISTS public.insurance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insurance_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  document_type text,
  file_url text,
  wa_message_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  uploaded_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.insurance_documents IS 
'Insurance-related documents submitted over WhatsApp (certificates, carte jaune, photos).';

COMMENT ON COLUMN public.insurance_documents.document_type IS 
'Document type: certificate, carte_jaune, photo, other';

-- Insurance: Quote Requests
CREATE TABLE IF NOT EXISTS public.insurance_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insurance_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  intent_id uuid REFERENCES public.ai_agent_intents(id) ON UPDATE CASCADE ON DELETE SET NULL,
  request_type text,
  status text DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  quote_details jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.insurance_quote_requests IS 
'Requests for new or renewed insurance cover. Created by Insurance agent from chat, then processed by human/partner.';

COMMENT ON COLUMN public.insurance_quote_requests.request_type IS 
'Request type: new, renewal';

COMMENT ON COLUMN public.insurance_quote_requests.status IS 
'Status: pending, in_review, approved, rejected';

COMMENT ON COLUMN public.insurance_quote_requests.quote_details IS 
'Premium, coverage, etc. filled later by human/partner';

-- =====================================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================================

-- Rides indexes
CREATE INDEX IF NOT EXISTS idx_rides_saved_locations_user_id ON public.rides_saved_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_saved_locations_label ON public.rides_saved_locations(user_id, label);

CREATE INDEX IF NOT EXISTS idx_rides_trips_rider_user_id ON public.rides_trips(rider_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_driver_user_id ON public.rides_trips(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_status ON public.rides_trips(status);
CREATE INDEX IF NOT EXISTS idx_rides_trips_scheduled_at ON public.rides_trips(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_trips_created_at ON public.rides_trips(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rides_driver_status_user_id ON public.rides_driver_status(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_online ON public.rides_driver_status(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_location ON public.rides_driver_status(current_lat, current_lng) WHERE is_online = true;

-- Insurance indexes
CREATE INDEX IF NOT EXISTS idx_insurance_profiles_user_id ON public.insurance_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_profiles_vehicle_id ON public.insurance_profiles(vehicle_identifier);

CREATE INDEX IF NOT EXISTS idx_insurance_documents_profile_id ON public.insurance_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_documents_type ON public.insurance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_insurance_documents_wa_message_id ON public.insurance_documents(wa_message_id);

CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_profile_id ON public.insurance_quote_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_agent_id ON public.insurance_quote_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_intent_id ON public.insurance_quote_requests(intent_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_status ON public.insurance_quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_type_status ON public.insurance_quote_requests(request_type, status);

COMMIT;
