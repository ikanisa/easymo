-- Create configuration key-value store for feature flags and operational settings
CREATE TABLE IF NOT EXISTS public.configuration (
  key TEXT PRIMARY KEY,
  description TEXT,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.configuration (key, description, value)
VALUES (
  'feature_flags',
  'Feature toggle map managed by operations. Example: {"enable_offline_queue": true}',
  '{}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins manage configuration"
  ON public.configuration
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "Staff can read configuration"
  ON public.configuration
  FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE OR REPLACE FUNCTION public.update_configuration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS configuration_set_updated_at ON public.configuration;
CREATE TRIGGER configuration_set_updated_at
  BEFORE UPDATE ON public.configuration
  FOR EACH ROW
  EXECUTE FUNCTION public.update_configuration_timestamp();
