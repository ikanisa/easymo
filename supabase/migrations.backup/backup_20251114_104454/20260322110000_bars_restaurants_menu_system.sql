BEGIN;

-- Bars and Restaurants Management System
-- Allows vendors to upload and manage their menus

-- Table for restaurant/bar menu items
CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES public.menus(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  is_available BOOLEAN DEFAULT true NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  created_by TEXT,
  ocr_extracted BOOLEAN DEFAULT false NOT NULL,
  ocr_confidence NUMERIC(3,2)
);

-- Table for menu upload requests (for OCR processing)
CREATE TABLE IF NOT EXISTS public.menu_upload_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  items_extracted INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  processed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'approved', 'rejected'))
);

-- Table for bar/restaurant managers
CREATE TABLE IF NOT EXISTS public.bar_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'manager',
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(bar_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('owner', 'manager', 'staff'))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_bar ON public.restaurant_menu_items(bar_id, is_available);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_category ON public.restaurant_menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_upload_requests_bar ON public.menu_upload_requests(bar_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_upload_requests_status ON public.menu_upload_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_bar_managers_bar ON public.bar_managers(bar_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bar_managers_user ON public.bar_managers(user_id, is_active);

-- Enable RLS
ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_upload_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_managers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurant_menu_items
-- Anyone can read available menu items
CREATE POLICY "Anyone can read available menu items"
  ON public.restaurant_menu_items
  FOR SELECT
  TO authenticated, anon
  USING (is_available = true);

-- Bar managers can manage their menu items
CREATE POLICY "Bar managers can manage their menu items"
  ON public.restaurant_menu_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bar_managers
      WHERE bar_managers.bar_id = restaurant_menu_items.bar_id
        AND bar_managers.user_id = auth.uid()
        AND bar_managers.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bar_managers
      WHERE bar_managers.bar_id = restaurant_menu_items.bar_id
        AND bar_managers.user_id = auth.uid()
        AND bar_managers.is_active = true
    )
  );

-- Service role can manage all
CREATE POLICY "Service role can manage all menu items"
  ON public.restaurant_menu_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for menu_upload_requests
-- Bar managers can view their upload requests
CREATE POLICY "Bar managers can view their upload requests"
  ON public.menu_upload_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bar_managers
      WHERE bar_managers.bar_id = menu_upload_requests.bar_id
        AND bar_managers.user_id = auth.uid()
        AND bar_managers.is_active = true
    )
  );

-- Bar managers can create upload requests
CREATE POLICY "Bar managers can create upload requests"
  ON public.menu_upload_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bar_managers
      WHERE bar_managers.bar_id = menu_upload_requests.bar_id
        AND bar_managers.user_id = auth.uid()
        AND bar_managers.is_active = true
    )
  );

-- Service role can manage all
CREATE POLICY "Service role can manage all upload requests"
  ON public.menu_upload_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for bar_managers
-- Users can view their own manager roles
CREATE POLICY "Users can view their own manager roles"
  ON public.bar_managers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can manage all
CREATE POLICY "Service role can manage all bar managers"
  ON public.bar_managers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_restaurant_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_restaurant_menu_items_updated_at
  BEFORE UPDATE ON public.restaurant_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_menu_items_updated_at();

CREATE TRIGGER trigger_update_bar_managers_updated_at
  BEFORE UPDATE ON public.bar_managers
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_menu_items_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.restaurant_menu_items IS 'Menu items for bars and restaurants, extracted from OCR or manually entered';
COMMENT ON TABLE public.menu_upload_requests IS 'Tracks menu file uploads for OCR processing and approval workflow';
COMMENT ON TABLE public.bar_managers IS 'Associates users with bars/restaurants they can manage';

COMMIT;
