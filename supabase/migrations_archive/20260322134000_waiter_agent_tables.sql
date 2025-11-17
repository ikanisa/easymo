BEGIN;

-- =====================================================
-- Waiter AI supporting tables
-- Creates the minimal storage used by waiter-ai-agent
-- =====================================================

CREATE TABLE IF NOT EXISTS public.waiter_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  restaurant_id TEXT,
  table_number TEXT,
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}'::JSONB,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  last_activity TIMESTAMPTZ DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_waiter_conversations_user
  ON public.waiter_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_waiter_conversations_status
  ON public.waiter_conversations(status);

CREATE TABLE IF NOT EXISTS public.waiter_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.waiter_conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  "timestamp" TIMESTAMPTZ DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_waiter_messages_conversation
  ON public.waiter_messages(conversation_id, "timestamp");

CREATE TABLE IF NOT EXISTS public.draft_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.waiter_conversations(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  subtotal NUMERIC(10,2) DEFAULT 0 CHECK (subtotal >= 0),
  tax NUMERIC(10,2) DEFAULT 0 CHECK (tax >= 0),
  total NUMERIC(10,2) DEFAULT 0 CHECK (total >= 0),
  status TEXT DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_draft_orders_user_status
  ON public.draft_orders(user_id, status);

CREATE TABLE IF NOT EXISTS public.draft_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_order_id UUID NOT NULL REFERENCES public.draft_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  options JSONB DEFAULT '{}'::JSONB,
  special_requests TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_draft_order_items_order
  ON public.draft_order_items(draft_order_id);

CREATE TABLE IF NOT EXISTS public.waiter_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_code TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  restaurant_id TEXT,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  reservation_datetime TIMESTAMPTZ NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  special_requests TEXT,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_waiter_reservations_user
  ON public.waiter_reservations(user_id);

CREATE TABLE IF NOT EXISTS public.waiter_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
  service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
  comment TEXT,
  would_recommend BOOLEAN,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

COMMIT;
