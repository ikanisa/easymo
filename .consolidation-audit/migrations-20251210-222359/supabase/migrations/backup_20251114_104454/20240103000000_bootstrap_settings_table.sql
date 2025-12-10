-- Create the shared settings table up front so later migrations can rely on it.
CREATE TABLE IF NOT EXISTS public.settings (
  id SERIAL PRIMARY KEY,
  subscription_price NUMERIC NOT NULL DEFAULT 0,
  search_radius_km NUMERIC NOT NULL DEFAULT 5,
  max_results INTEGER NOT NULL DEFAULT 10,
  momo_payee_number TEXT NOT NULL DEFAULT '',
  support_phone_e164 TEXT NOT NULL DEFAULT '',
  admin_whatsapp_numbers TEXT,
  key TEXT UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
