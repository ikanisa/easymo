BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS deeplink_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow text NOT NULL CHECK (flow IN ('insurance_attach', 'basket_open', 'generate_qr')),
  token text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  msisdn_e164 text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  multi_use boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deeplink_tokens_flow ON deeplink_tokens(flow);
CREATE INDEX IF NOT EXISTS idx_deeplink_tokens_expires ON deeplink_tokens(expires_at);

COMMENT ON TABLE deeplink_tokens IS 'Tokens that bootstrap WA flows without home menu.';

CREATE TABLE IF NOT EXISTS deeplink_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES deeplink_tokens(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('issued', 'opened', 'expired', 'denied', 'completed')),
  actor_msisdn text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
