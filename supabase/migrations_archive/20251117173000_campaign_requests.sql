BEGIN;

CREATE TABLE IF NOT EXISTS public.campaign_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  segment_id TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  send_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','scheduled','sent','failed','cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_campaign_requests_channel ON public.campaign_requests(channel);
CREATE INDEX IF NOT EXISTS idx_campaign_requests_status ON public.campaign_requests(status);
CREATE INDEX IF NOT EXISTS idx_campaign_requests_send_time ON public.campaign_requests(send_time);

ALTER TABLE public.campaign_requests ENABLE ROW LEVEL SECURITY;

-- Service-role will manage this table. Owner policies can be added later per tenant/business.

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campaign_requests_updated ON public.campaign_requests;
CREATE TRIGGER trg_campaign_requests_updated BEFORE UPDATE ON public.campaign_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;

