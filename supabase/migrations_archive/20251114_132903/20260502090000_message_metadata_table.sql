BEGIN;

CREATE TABLE IF NOT EXISTS public.message_metadata (
  message_id bigint PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  agent_conversation_id uuid REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  agent_message_id uuid REFERENCES public.agent_messages(id) ON DELETE SET NULL,
  wa_message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_msisdn text,
  recipient_msisdn text,
  message_type text,
  status text NOT NULL DEFAULT 'received' CHECK (
    status IN (
      'received',
      'queued',
      'processing',
      'sent',
      'delivered',
      'read',
      'failed',
      'skipped',
      'expired'
    )
  ),
  status_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL DEFAULT (timezone('utc', now()) + interval '90 days')
);

CREATE UNIQUE INDEX IF NOT EXISTS message_metadata_wa_message_id_uq
  ON public.message_metadata (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS message_metadata_conversation_idx
  ON public.message_metadata (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS message_metadata_agent_conversation_idx
  ON public.message_metadata (agent_conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS message_metadata_status_idx
  ON public.message_metadata (status, created_at DESC);

CREATE INDEX IF NOT EXISTS message_metadata_expires_at_idx
  ON public.message_metadata (expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_message_metadata_updated_at'
  ) THEN
    CREATE TRIGGER trg_message_metadata_updated_at
      BEFORE UPDATE ON public.message_metadata
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

INSERT INTO public.message_metadata (
  message_id,
  conversation_id,
  wa_message_id,
  direction,
  sender_msisdn,
  recipient_msisdn,
  message_type,
  status,
  metadata,
  sent_at,
  created_at,
  updated_at,
  expires_at
)
SELECT
  m.id,
  m.conversation_id,
  NULLIF(m.body->>'id', ''),
  CASE WHEN lower(m.dir) = 'in' THEN 'inbound' ELSE 'outbound' END,
  NULLIF(m.body->>'from', ''),
  NULLIF(m.body->>'to', ''),
  NULLIF(m.body->>'type', ''),
  CASE
    WHEN lower(m.dir) = 'in' THEN 'received'
    ELSE 'sent'
  END,
  CASE
    WHEN jsonb_typeof(m.body) = 'object' THEN
      COALESCE(
        jsonb_strip_nulls(jsonb_build_object(
          'context', m.body->'context',
          'interactive', m.body->'interactive',
          'location', m.body->'location',
          'referral', m.body->'referral',
          'text', m.body->'text'
        )),
        '{}'::jsonb
      )
    ELSE '{}'::jsonb
  END,
  CASE
    WHEN (m.body->>'timestamp') ~ '^\d+$' THEN
      CASE
        WHEN length(m.body->>'timestamp') >= 13 THEN to_timestamp(((m.body->>'timestamp')::bigint) / 1000.0)
        ELSE to_timestamp((m.body->>'timestamp')::bigint)
      END
    ELSE NULL
  END,
  COALESCE(m.created_at, timezone('utc', now())),
  COALESCE(m.created_at, timezone('utc', now())),
  COALESCE(m.created_at, timezone('utc', now())) + interval '90 days'
FROM public.messages m
LEFT JOIN public.message_metadata mm ON mm.message_id = m.id
WHERE mm.message_id IS NULL;

ALTER TABLE public.message_metadata ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_metadata'
      AND policyname = 'message_metadata_service_role'
  ) THEN
    CREATE POLICY message_metadata_service_role
      ON public.message_metadata
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

COMMIT;
