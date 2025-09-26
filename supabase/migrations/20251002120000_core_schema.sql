-- Core schema for WhatsApp dine-in ordering platform
-- Additive migration: introduces base entities, enums, and helper triggers

-- Ensure uuid generation is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------
-- Enum definitions
-- ----------
CREATE TYPE public.menu_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.menu_source AS ENUM ('ocr', 'manual');
CREATE TYPE public.bar_contact_role AS ENUM ('manager', 'staff');
CREATE TYPE public.cart_status AS ENUM ('open', 'locked', 'expired');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'served', 'cancelled');
CREATE TYPE public.order_event_type AS ENUM (
  'created',
  'paid',
  'served',
  'cancelled',
  'customer_paid_signal',
  'vendor_nudge',
  'admin_override'
);
CREATE TYPE public.order_event_actor AS ENUM ('system', 'customer', 'vendor', 'admin');
CREATE TYPE public.notification_status AS ENUM ('queued', 'sent', 'failed');
CREATE TYPE public.notification_channel AS ENUM ('template', 'freeform', 'flow');
CREATE TYPE public.session_role AS ENUM ('customer', 'vendor', 'admin', 'system');
CREATE TYPE public.item_modifier_type AS ENUM ('single', 'multiple');
CREATE TYPE public.ocr_job_status AS ENUM ('queued', 'processing', 'succeeded', 'failed');

-- ----------
-- Timestamp helper
-- ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ----------
-- Core reference tables
-- ----------
CREATE TABLE public.bars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  location_text text,
  country text,
  city_area text,
  currency text,
  momo_code text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.bar_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  number_e164 text NOT NULL,
  role public.bar_contact_role NOT NULL DEFAULT 'staff',
  is_active boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  added_by text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT bar_numbers_unique_number_per_bar UNIQUE (bar_id, number_e164)
);

CREATE TABLE public.bar_settings (
  bar_id uuid PRIMARY KEY REFERENCES public.bars(id) ON DELETE CASCADE,
  allow_direct_customer_chat boolean NOT NULL DEFAULT false,
  order_auto_ack boolean NOT NULL DEFAULT false,
  default_prep_minutes integer NOT NULL DEFAULT 0 CHECK (default_prep_minutes >= 0 AND default_prep_minutes <= 240),
  service_charge_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (service_charge_pct >= 0 AND service_charge_pct <= 25),
  payment_instructions text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status public.menu_status NOT NULL DEFAULT 'draft',
  source public.menu_source NOT NULL DEFAULT 'manual',
  source_file_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_by text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  published_at timestamptz,
  CONSTRAINT menus_unique_version_per_bar UNIQUE (bar_id, version)
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  parent_category_id uuid REFERENCES public.categories(id),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  short_description text,
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  currency text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.item_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  name text NOT NULL,
  modifier_type public.item_modifier_type NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.bar_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  label text NOT NULL,
  qr_payload text NOT NULL,
  token_nonce text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_scan_at timestamptz,
  CONSTRAINT bar_tables_unique_label_per_bar UNIQUE (bar_id, label),
  CONSTRAINT bar_tables_unique_payload UNIQUE (qr_payload)
);

-- ----------
-- Customer domain
-- ----------
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL UNIQUE,
  display_name text,
  locale text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at timestamptz
);

CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  table_label text,
  status public.cart_status NOT NULL DEFAULT 'open',
  subtotal_minor integer NOT NULL DEFAULT 0,
  service_charge_minor integer NOT NULL DEFAULT 0,
  total_minor integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  item_id uuid,
  item_name text NOT NULL,
  item_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  qty integer NOT NULL CHECK (qty >= 1),
  unit_price_minor integer NOT NULL CHECK (unit_price_minor >= 0),
  flags_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  modifiers_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  line_total_minor integer NOT NULL CHECK (line_total_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ----------
-- Orders domain
-- ----------
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text UNIQUE,
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  source_cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  table_label text,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal_minor integer NOT NULL DEFAULT 0,
  service_charge_minor integer NOT NULL DEFAULT 0,
  total_minor integer NOT NULL DEFAULT 0,
  currency text,
  momo_code_used text,
  note text,
  paid_at timestamptz,
  served_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id uuid,
  item_name text NOT NULL,
  item_description text,
  qty integer NOT NULL CHECK (qty >= 1),
  unit_price_minor integer NOT NULL CHECK (unit_price_minor >= 0),
  flags_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  modifiers_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  line_total_minor integer NOT NULL CHECK (line_total_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type public.order_event_type NOT NULL,
  actor_type public.order_event_actor NOT NULL,
  actor_identifier text,
  note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ----------
-- Session & flows
-- ----------
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL,
  role public.session_role NOT NULL,
  bar_id uuid REFERENCES public.bars(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  current_flow text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  flow_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_interaction_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.flow_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id text NOT NULL,
  screen_id text,
  action_id text,
  wa_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ----------
-- Notifications & messaging
-- ----------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  to_wa_id text NOT NULL,
  template_name text,
  notification_type text NOT NULL,
  channel public.notification_channel NOT NULL DEFAULT 'template',
  status public.notification_status NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ----------
-- OCR & operational logging
-- ----------
CREATE TABLE public.ocr_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  menu_id uuid REFERENCES public.menus(id) ON DELETE SET NULL,
  source_file_id text,
  status public.ocr_job_status NOT NULL DEFAULT 'queued',
  error_message text,
  attempts smallint NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  result_path text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.webhook_logs (
  id bigserial PRIMARY KEY,
  endpoint text NOT NULL,
  wa_id text,
  status_code integer,
  error_message text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text,
  actor_type text,
  action text NOT NULL,
  target_table text,
  target_id text,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ----------
-- Indexes
-- ----------
CREATE INDEX idx_bar_numbers_active ON public.bar_numbers (bar_id) WHERE is_active;
CREATE INDEX idx_categories_menu_parent ON public.categories (menu_id, parent_category_id, sort_order);
CREATE INDEX idx_items_menu_category ON public.items (menu_id, category_id, sort_order);
CREATE INDEX idx_items_availability ON public.items (bar_id, is_available);
CREATE INDEX idx_bar_tables_bar_active ON public.bar_tables (bar_id) WHERE is_active;
CREATE INDEX idx_carts_customer_status ON public.carts (customer_id, status);
CREATE INDEX idx_orders_bar_status_created ON public.orders (bar_id, status, created_at DESC);
CREATE INDEX idx_order_events_order_created ON public.order_events (order_id, created_at DESC);
CREATE INDEX idx_sessions_wa_role ON public.sessions (wa_id, role);
CREATE INDEX idx_notifications_status_created ON public.notifications (status, created_at);
CREATE INDEX idx_ocr_jobs_status_created ON public.ocr_jobs (status, created_at DESC);
CREATE INDEX idx_webhook_logs_endpoint_time ON public.webhook_logs (endpoint, received_at DESC);
CREATE INDEX idx_audit_log_table_time ON public.audit_log (target_table, created_at DESC);

-- ----------
-- Updated-at triggers
-- ----------
CREATE TRIGGER trg_bars_updated
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bar_numbers_updated
  BEFORE UPDATE ON public.bar_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bar_settings_updated
  BEFORE UPDATE ON public.bar_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_menus_updated
  BEFORE UPDATE ON public.menus
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_categories_updated
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_items_updated
  BEFORE UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_item_modifiers_updated
  BEFORE UPDATE ON public.item_modifiers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bar_tables_updated
  BEFORE UPDATE ON public.bar_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_carts_updated
  BEFORE UPDATE ON public.carts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sessions_updated
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_notifications_updated
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_ocr_jobs_updated
  BEFORE UPDATE ON public.ocr_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
