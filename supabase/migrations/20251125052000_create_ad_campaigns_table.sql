-- ================================================================
-- Ad Campaigns Table for Sales Agent
-- ================================================================
-- Creates the ad_campaigns table for tracking advertising
-- campaigns created through the Sales Agent.
--
-- Features:
--   - Campaign management with budget tracking
--   - Target audience configuration
--   - Performance metrics (views, clicks, conversions)
--   - Sora-2 video script storage
--
-- Created: 2025-11-25
-- ================================================================

BEGIN;

-- ================================================================
-- 1. AD CAMPAIGNS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Owner reference
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  user_phone TEXT, -- For WhatsApp users without profile
  
  -- Campaign details
  campaign_name TEXT NOT NULL,
  product_name TEXT,
  product_description TEXT,
  
  -- Budget and duration
  budget NUMERIC(10,2),
  currency TEXT DEFAULT 'RWF',
  duration_days INTEGER DEFAULT 7,
  daily_budget NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN duration_days > 0 THEN budget / duration_days ELSE budget END
  ) STORED,
  
  -- Targeting
  target_audience JSONB DEFAULT '{}'::jsonb, -- {demographics, locations, interests}
  target_locations TEXT[] DEFAULT '{}'::text[],
  target_age_range INT4RANGE,
  
  -- Creative assets
  ad_script TEXT, -- Sora-2 generated script
  video_url TEXT, -- Generated video URL
  thumbnail_url TEXT,
  visual_prompts TEXT[] DEFAULT '{}'::text[], -- Sora-2 visual prompts
  
  -- A/B testing variants
  variant_a_copy TEXT,
  variant_b_copy TEXT,
  winning_variant TEXT CHECK (winning_variant IN ('A', 'B', 'undetermined')),
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'completed', 'cancelled')),
  
  -- Performance metrics
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  ctr NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN views > 0 THEN (clicks::NUMERIC / views::NUMERIC) * 100 ELSE 0 END
  ) STORED, -- Click-through rate
  cpc NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN clicks > 0 THEN spend / clicks ELSE 0 END
  ) STORED, -- Cost per click
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  scheduled_start_at TIMESTAMPTZ
);

COMMENT ON TABLE public.ad_campaigns IS 
  'Advertising campaigns created through the Sales Agent';

-- Indexes for ad_campaigns
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_user_id 
  ON public.ad_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_user_phone 
  ON public.ad_campaigns(user_phone);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status 
  ON public.ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_created_at 
  ON public.ad_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_started_at 
  ON public.ad_campaigns(started_at);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_ended_at 
  ON public.ad_campaigns(ended_at);

-- ================================================================
-- 2. AD CAMPAIGN ANALYTICS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ad_campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign reference
  campaign_id UUID REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  
  -- Date-based metrics
  date DATE NOT NULL,
  
  -- Daily metrics
  impressions INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  
  -- Audience breakdown (JSONB for flexibility)
  audience_breakdown JSONB DEFAULT '{}'::jsonb, -- {location: {}, age: {}, device: {}}
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, date)
);

COMMENT ON TABLE public.ad_campaign_analytics IS 
  'Daily analytics for ad campaigns';

-- Indexes for ad_campaign_analytics
CREATE INDEX IF NOT EXISTS idx_ad_campaign_analytics_campaign_id 
  ON public.ad_campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaign_analytics_date 
  ON public.ad_campaign_analytics(date DESC);

-- ================================================================
-- 3. ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaign_analytics ENABLE ROW LEVEL SECURITY;

-- Campaigns: Users can manage their own campaigns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_campaigns' 
    AND policyname = 'ad_campaigns_manage_own'
  ) THEN
    CREATE POLICY "ad_campaigns_manage_own"
      ON public.ad_campaigns
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Campaigns: Service role has full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_campaigns' 
    AND policyname = 'ad_campaigns_service_role'
  ) THEN
    CREATE POLICY "ad_campaigns_service_role"
      ON public.ad_campaigns
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Analytics: Users can view their campaign analytics
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_campaign_analytics' 
    AND policyname = 'ad_campaign_analytics_view_own'
  ) THEN
    CREATE POLICY "ad_campaign_analytics_view_own"
      ON public.ad_campaign_analytics
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.ad_campaigns
          WHERE id = ad_campaign_analytics.campaign_id
          AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Analytics: Service role has full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ad_campaign_analytics' 
    AND policyname = 'ad_campaign_analytics_service_role'
  ) THEN
    CREATE POLICY "ad_campaign_analytics_service_role"
      ON public.ad_campaign_analytics
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ================================================================
-- 4. TRIGGERS
-- ================================================================

-- Updated_at trigger for ad_campaigns
CREATE OR REPLACE FUNCTION public.update_ad_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ad_campaigns_updated_at ON public.ad_campaigns;
CREATE TRIGGER trigger_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ad_campaigns_updated_at();

-- Updated_at trigger for ad_campaign_analytics (reuses the same function which just sets updated_at = NOW())
DROP TRIGGER IF EXISTS trigger_ad_campaign_analytics_updated_at ON public.ad_campaign_analytics;
CREATE TRIGGER trigger_ad_campaign_analytics_updated_at
  BEFORE UPDATE ON public.ad_campaign_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ad_campaigns_updated_at();

-- ================================================================
-- 5. HELPER FUNCTIONS
-- ================================================================

-- Create a new ad campaign
CREATE OR REPLACE FUNCTION public.create_ad_campaign(
  p_user_phone TEXT,
  p_campaign_name TEXT,
  p_product_name TEXT,
  p_budget NUMERIC DEFAULT NULL,
  p_duration_days INTEGER DEFAULT 7,
  p_target_audience JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign_id UUID;
BEGIN
  INSERT INTO public.ad_campaigns (
    user_phone,
    campaign_name,
    product_name,
    budget,
    duration_days,
    target_audience,
    status
  ) VALUES (
    p_user_phone,
    p_campaign_name,
    p_product_name,
    p_budget,
    p_duration_days,
    p_target_audience,
    'draft'
  )
  RETURNING id INTO v_campaign_id;

  RETURN v_campaign_id;
END;
$$;

-- Update campaign status
CREATE OR REPLACE FUNCTION public.update_campaign_status(
  p_campaign_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ad_campaigns
  SET 
    status = p_status,
    started_at = CASE WHEN p_status = 'active' AND started_at IS NULL THEN NOW() ELSE started_at END,
    ended_at = CASE WHEN p_status IN ('completed', 'cancelled') THEN NOW() ELSE ended_at END
  WHERE id = p_campaign_id;

  RETURN FOUND;
END;
$$;

-- Record campaign metric
CREATE OR REPLACE FUNCTION public.record_campaign_metric(
  p_campaign_id UUID,
  p_metric_type TEXT, -- 'view', 'click', 'conversion'
  p_spend NUMERIC DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update campaign totals
  UPDATE public.ad_campaigns
  SET 
    views = views + CASE WHEN p_metric_type = 'view' THEN 1 ELSE 0 END,
    clicks = clicks + CASE WHEN p_metric_type = 'click' THEN 1 ELSE 0 END,
    conversions = conversions + CASE WHEN p_metric_type = 'conversion' THEN 1 ELSE 0 END,
    spend = spend + p_spend
  WHERE id = p_campaign_id;

  -- Upsert daily analytics
  INSERT INTO public.ad_campaign_analytics (
    campaign_id,
    date,
    impressions,
    views,
    clicks,
    conversions,
    spend
  ) VALUES (
    p_campaign_id,
    CURRENT_DATE,
    CASE WHEN p_metric_type = 'impression' THEN 1 ELSE 0 END,
    CASE WHEN p_metric_type = 'view' THEN 1 ELSE 0 END,
    CASE WHEN p_metric_type = 'click' THEN 1 ELSE 0 END,
    CASE WHEN p_metric_type = 'conversion' THEN 1 ELSE 0 END,
    p_spend
  )
  ON CONFLICT (campaign_id, date)
  DO UPDATE SET
    impressions = ad_campaign_analytics.impressions + CASE WHEN p_metric_type = 'impression' THEN 1 ELSE 0 END,
    views = ad_campaign_analytics.views + CASE WHEN p_metric_type = 'view' THEN 1 ELSE 0 END,
    clicks = ad_campaign_analytics.clicks + CASE WHEN p_metric_type = 'click' THEN 1 ELSE 0 END,
    conversions = ad_campaign_analytics.conversions + CASE WHEN p_metric_type = 'conversion' THEN 1 ELSE 0 END,
    spend = ad_campaign_analytics.spend + p_spend,
    updated_at = NOW();

  RETURN TRUE;
END;
$$;

-- Get campaign stats
CREATE OR REPLACE FUNCTION public.get_campaign_stats(
  p_campaign_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign RECORD;
  v_daily_stats JSONB;
BEGIN
  SELECT * INTO v_campaign
  FROM public.ad_campaigns
  WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Campaign not found');
  END IF;

  -- Get daily stats
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'views', views,
      'clicks', clicks,
      'conversions', conversions,
      'spend', spend
    ) ORDER BY date DESC
  ) INTO v_daily_stats
  FROM public.ad_campaign_analytics
  WHERE campaign_id = p_campaign_id
  LIMIT 30;

  RETURN jsonb_build_object(
    'campaign_id', v_campaign.id,
    'campaign_name', v_campaign.campaign_name,
    'status', v_campaign.status,
    'budget', v_campaign.budget,
    'spend', v_campaign.spend,
    'views', v_campaign.views,
    'clicks', v_campaign.clicks,
    'conversions', v_campaign.conversions,
    'ctr', v_campaign.ctr,
    'cpc', v_campaign.cpc,
    'started_at', v_campaign.started_at,
    'ended_at', v_campaign.ended_at,
    'daily_stats', COALESCE(v_daily_stats, '[]'::jsonb)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_ad_campaign TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_campaign_status TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_campaign_metric TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_campaign_stats TO authenticated, anon, service_role;

COMMIT;
