-- Transaction wrapper for production safety
BEGIN;

-- Minimal core schema snapshot for tests
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  received_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint_time ON public.webhook_logs(endpoint, received_at);


COMMIT;
