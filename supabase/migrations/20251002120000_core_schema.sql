-- Transaction wrapper for production safety
BEGIN;

-- Minimal core schema snapshot for tests
CREATE TABLE public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  received_at timestamptz default now()
);

CREATE INDEX idx_webhook_logs_endpoint_time ON public.webhook_logs(endpoint, received_at);


COMMIT;
