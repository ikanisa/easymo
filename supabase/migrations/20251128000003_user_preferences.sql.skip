BEGIN;

CREATE TABLE IF NOT EXISTS public.user_search_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
  preference_type text CHECK (preference_type IN ('job', 'property')),
  
  -- Job preferences
  job_categories text[],
  employment_types text[],
  salary_min numeric,
  salary_currency text DEFAULT 'EUR',
  skills text[],
  
  -- Property preferences  
  property_types text[],
  listing_types text[], -- 'rent', 'sale'
  min_bedrooms int,
  max_price numeric,
  location_areas text[],
  
  -- Embeddings for matching
  preference_embedding vector(1536), -- Matching openai-text-embedding-3-small dimension
  
  -- Notifications
  notify_whatsapp boolean DEFAULT true,
  notification_frequency text DEFAULT 'daily', -- 'realtime', 'daily', 'weekly'
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_search_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own preferences" 
  ON public.user_search_preferences FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" 
  ON public.user_search_preferences FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
  ON public.user_search_preferences FOR UPDATE 
  USING (auth.uid() = user_id);

-- Index for vector similarity search (optional, but good for matching)
CREATE INDEX IF NOT EXISTS idx_user_prefs_embedding 
  ON public.user_search_preferences 
  USING hnsw (preference_embedding vector_cosine_ops);

COMMIT;
