BEGIN;

-- Core tables without basket/sacco/campaign references
-- These tables may already partially exist, so use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_whatsapp TEXT,
  description TEXT,
  catalog_url TEXT,
  location_text TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  delivery_address JSONB,
  items JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu system
CREATE TABLE IF NOT EXISTS public.menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID REFERENCES public.menus(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category TEXT,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_profile ON public.orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_business ON public.orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON public.businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_active ON public.businesses(is_active);
CREATE INDEX IF NOT EXISTS idx_menus_business ON public.menus(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON public.menu_items(menu_id);

COMMIT;
