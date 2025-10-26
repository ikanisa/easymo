BEGIN;
CREATE TABLE IF NOT EXISTS basket_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES baskets(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT NOW() + interval '14 days',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_basket_invite_tokens_basket ON basket_invite_tokens (basket_id);

CREATE OR REPLACE FUNCTION issue_basket_invite_token(
  _basket_id uuid,
  _created_by uuid,
  _explicit_token text DEFAULT NULL,
  _ttl interval DEFAULT interval '14 days'
)
RETURNS basket_invite_tokens
LANGUAGE plpgsql
AS $$
DECLARE
  new_token text;
  inserted basket_invite_tokens;
BEGIN
  new_token := COALESCE(
    _explicit_token,
    encode(gen_random_bytes(12), 'hex')
  );

  INSERT INTO basket_invite_tokens (basket_id, token, created_by, expires_at)
  VALUES (
    _basket_id,
    new_token,
    _created_by,
    timezone('utc', now()) + COALESCE(_ttl, interval '14 days')
  )
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$;
COMMIT;
