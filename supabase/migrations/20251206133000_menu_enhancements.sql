BEGIN;

-- Migration 5: Menu enhancements for promotions, dietary tags, and OCR upload tracking

-- Add promotion and dietary columns to restaurant_menu_items if they exist
DO $$
BEGIN
  -- Check if restaurant_menu_items table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_menu_items') THEN
    -- Add promotion columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_menu_items' AND column_name = 'promotion_price') THEN
      ALTER TABLE public.restaurant_menu_items ADD COLUMN promotion_price DECIMAL(10, 2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_menu_items' AND column_name = 'promotion_end_date') THEN
      ALTER TABLE public.restaurant_menu_items ADD COLUMN promotion_end_date TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_menu_items' AND column_name = 'promotion_label') THEN
      ALTER TABLE public.restaurant_menu_items ADD COLUMN promotion_label TEXT;
    END IF;
    
    -- Add dietary and allergen columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_menu_items' AND column_name = 'dietary_tags') THEN
      ALTER TABLE public.restaurant_menu_items ADD COLUMN dietary_tags TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_menu_items' AND column_name = 'allergens') THEN
      ALTER TABLE public.restaurant_menu_items ADD COLUMN allergens TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_menu_items' AND column_name = 'sort_order') THEN
      ALTER TABLE public.restaurant_menu_items ADD COLUMN sort_order INTEGER DEFAULT 999;
    END IF;
    
    -- Create index on sort_order
    CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_sort ON public.restaurant_menu_items(bar_id, sort_order, is_available);
  END IF;
END $$;

-- Create menu_upload_requests table for tracking OCR processing
CREATE TABLE IF NOT EXISTS public.menu_upload_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL,
  business_id UUID,
  uploaded_by UUID NOT NULL,
  media_id TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'pdf', 'document')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_items JSONB,
  extraction_confidence REAL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  -- Add foreign key constraints if tables exist
  CONSTRAINT fk_menu_upload_bar FOREIGN KEY (bar_id) REFERENCES public.bars(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_upload_user FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_upload_bar_id ON public.menu_upload_requests(bar_id);
CREATE INDEX IF NOT EXISTS idx_menu_upload_status ON public.menu_upload_requests(status);
CREATE INDEX IF NOT EXISTS idx_menu_upload_created ON public.menu_upload_requests(created_at DESC);

-- Enable RLS
ALTER TABLE public.menu_upload_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "menu_upload_read_own_bar" ON public.menu_upload_requests;
CREATE POLICY "menu_upload_read_own_bar" ON public.menu_upload_requests
  FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bar_managers bm
      WHERE bm.bar_id = menu_upload_requests.bar_id
        AND bm.user_id = auth.uid()
        AND bm.is_active = true
    )
  );

DROP POLICY IF EXISTS "menu_upload_insert_own_bar" ON public.menu_upload_requests;
CREATE POLICY "menu_upload_insert_own_bar" ON public.menu_upload_requests
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bar_managers bm
      WHERE bm.bar_id = bar_id
        AND bm.user_id = auth.uid()
        AND bm.is_active = true
    )
  );

COMMIT;
