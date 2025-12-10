BEGIN;

-- ===========================================================
-- Queue table to buffer WA events before streaming to BigQuery
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.wa_events_bq_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_event_id UUID REFERENCES public.wa_events(id) ON DELETE CASCADE,
  wa_message_id TEXT,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_events_bq_queue_ready
  ON public.wa_events_bq_queue (next_attempt_at ASC, attempts ASC);

CREATE INDEX IF NOT EXISTS idx_wa_events_bq_queue_message_id
  ON public.wa_events_bq_queue (wa_message_id);

-- Maintain updated_at
CREATE OR REPLACE FUNCTION public.set_wa_events_bq_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_set_wa_events_bq_queue_updated_at'
  ) THEN
    DROP TRIGGER trg_set_wa_events_bq_queue_updated_at ON public.wa_events_bq_queue;
  END IF;
END $$;

CREATE TRIGGER trg_set_wa_events_bq_queue_updated_at
BEFORE UPDATE ON public.wa_events_bq_queue
FOR EACH ROW
EXECUTE FUNCTION public.set_wa_events_bq_queue_updated_at();

-- Enqueue trigger: capture every wa_events insert
CREATE OR REPLACE FUNCTION public.enqueue_wa_events_bq_queue()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wa_events_bq_queue (wa_event_id, wa_message_id, payload)
  VALUES (NEW.id, NEW.message_id, to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_enqueue_wa_events_bq_queue'
  ) THEN
    DROP TRIGGER trg_enqueue_wa_events_bq_queue ON public.wa_events;
  END IF;
END $$;

CREATE TRIGGER trg_enqueue_wa_events_bq_queue
AFTER INSERT ON public.wa_events
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_wa_events_bq_queue();

-- Leasing function to lock a batch of rows using SKIP LOCKED semantics
CREATE OR REPLACE FUNCTION public.lease_wa_events_bq_queue(batch_size INTEGER DEFAULT 200, locker TEXT DEFAULT 'worker')
RETURNS SETOF public.wa_events_bq_queue
LANGUAGE SQL
AS $$
WITH candidates AS (
  SELECT id
  FROM public.wa_events_bq_queue
  WHERE (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes')
    AND next_attempt_at <= NOW()
  ORDER BY next_attempt_at ASC, created_at ASC
  LIMIT GREATEST(batch_size, 1)
)
UPDATE public.wa_events_bq_queue q
SET locked_at = NOW(),
    locked_by = COALESCE(locker, 'worker'),
    updated_at = NOW()
FROM candidates c
WHERE q.id = c.id
RETURNING q.*;
$$;

ALTER TABLE public.wa_events_bq_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wa_events_bq_queue'
      AND policyname = 'svc_rw_wa_events_bq_queue'
  ) THEN
    CREATE POLICY svc_rw_wa_events_bq_queue
      ON public.wa_events_bq_queue
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public.wa_events_bq_queue TO postgres, service_role;

COMMENT ON TABLE public.wa_events_bq_queue IS 'Buffer of WhatsApp events waiting to be streamed to BigQuery';
COMMENT ON COLUMN public.wa_events_bq_queue.payload IS 'Full wa_events row captured at insert time';

COMMIT;
