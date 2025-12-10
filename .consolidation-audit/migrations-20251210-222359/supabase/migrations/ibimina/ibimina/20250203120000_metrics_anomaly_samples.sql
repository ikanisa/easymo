-- Helper function for role checking using org_memberships
CREATE OR REPLACE FUNCTION public.has_admin_role(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if user has admin role in any organization
  RETURN EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE user_id = p_user_id 
      AND role IN ('ADMIN', 'OWNER', 'SYSTEM_ADMIN')
      AND status = 'ACTIVE'
  );
END;
$$;

COMMENT ON FUNCTION public.has_admin_role(uuid) IS 'Check if user has admin privileges via org_memberships';

create table if not exists public.system_metric_samples (
  id bigserial primary key,
  event text not null,
  total bigint not null default 0,
  collected_at timestamptz not null default now()
);

create index if not exists idx_system_metric_samples_event_time
  on public.system_metric_samples (event, collected_at desc);

alter table public.system_metric_samples enable row level security;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Admins can view metric samples" ON public.system_metric_samples;
DROP POLICY IF EXISTS "Admins can manage metric samples" ON public.system_metric_samples;

-- Create new policies using the fixed function
create policy "Admins can view metric samples"
  on public.system_metric_samples for select
  using (public.has_admin_role(auth.uid()));

create policy "Admins can manage metric samples"
  on public.system_metric_samples for all
  using (public.has_admin_role(auth.uid()))
  with check (public.has_admin_role(auth.uid()));

-- Grant permissions
GRANT SELECT ON public.system_metric_samples TO authenticated;
GRANT ALL ON public.system_metric_samples TO service_role;

COMMENT ON TABLE public.system_metric_samples IS 'System-wide metric samples for anomaly detection and monitoring';
