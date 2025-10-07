BEGIN;

-- Enable and enforce RLS on basket domain tables
ALTER TABLE public.baskets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baskets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.basket_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basket_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.basket_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basket_contributions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.basket_joins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basket_joins FORCE ROW LEVEL SECURITY;

-- Drop existing policies if any so we can recreate them idempotently
DROP POLICY IF EXISTS baskets_select_members ON public.baskets;
DROP POLICY IF EXISTS baskets_mutate_owner ON public.baskets;
DROP POLICY IF EXISTS baskets_insert_owner ON public.baskets;
DROP POLICY IF EXISTS basket_members_select_related ON public.basket_members;
DROP POLICY IF EXISTS basket_members_delete_self ON public.basket_members;
DROP POLICY IF EXISTS basket_members_insert_self ON public.basket_members;
DROP POLICY IF EXISTS basket_contributions_select_related ON public.basket_contributions;
DROP POLICY IF EXISTS basket_joins_select_related ON public.basket_joins;

-- Basket table policies
CREATE POLICY baskets_select_members
  ON public.baskets
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL AND (
        owner_profile_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.basket_members bm
          WHERE bm.basket_id = public.baskets.id
            AND (
              bm.profile_id = auth.uid()
              OR bm.user_id = auth.uid()
              OR (
                COALESCE(bm.whatsapp, '') <> ''
                AND bm.whatsapp = COALESCE(public.profile_wa(auth.uid()), '')
              )
            )
        )
      )
    )
  );

CREATE POLICY baskets_insert_owner
  ON public.baskets
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND owner_profile_id = auth.uid())
  );

CREATE POLICY baskets_mutate_owner
  ON public.baskets
  FOR UPDATE
  USING (auth.role() = 'service_role' OR owner_profile_id = auth.uid())
  WITH CHECK (auth.role() = 'service_role' OR owner_profile_id = auth.uid());

CREATE POLICY baskets_delete_owner
  ON public.baskets
  FOR DELETE
  USING (auth.role() = 'service_role' OR owner_profile_id = auth.uid());

-- Basket members policies
CREATE POLICY basket_members_select_related
  ON public.basket_members
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL AND (
        profile_id = auth.uid()
        OR user_id = auth.uid()
        OR COALESCE(whatsapp, '') = COALESCE(public.profile_wa(auth.uid()), '')
        OR EXISTS (
          SELECT 1 FROM public.baskets b
          WHERE b.id = public.basket_members.basket_id
            AND b.owner_profile_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY basket_members_insert_self
  ON public.basket_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL AND (
        COALESCE(user_id, profile_id) = auth.uid()
        OR COALESCE(public.profile_wa(auth.uid()), '') = COALESCE(whatsapp, '')
      )
    )
  );

CREATE POLICY basket_members_delete_self
  ON public.basket_members
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR auth.uid() IS NOT NULL AND (
      profile_id = auth.uid()
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.baskets b
        WHERE b.id = public.basket_members.basket_id
          AND b.owner_profile_id = auth.uid()
      )
    )
  );

-- Basket contributions policies
CREATE POLICY basket_contributions_select_related
  ON public.basket_contributions
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL AND (
        profile_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.basket_members bm
          WHERE bm.basket_id = public.basket_contributions.basket_id
            AND (
              bm.profile_id = auth.uid()
              OR bm.user_id = auth.uid()
              OR COALESCE(bm.whatsapp, '') = COALESCE(public.profile_wa(auth.uid()), '')
            )
        )
      )
    )
  );

-- Basket joins policies
CREATE POLICY basket_joins_select_related
  ON public.basket_joins
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL AND (
        user_id = auth.uid()
        OR COALESCE(whatsapp, '') = COALESCE(public.profile_wa(auth.uid()), '')
        OR EXISTS (
          SELECT 1 FROM public.baskets b
          WHERE b.id = public.basket_joins.basket_id
            AND b.owner_profile_id = auth.uid()
        )
      )
    )
  );

-- Rate limit trigger for basket creation
CREATE OR REPLACE FUNCTION public.fn_assert_basket_create_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner uuid := NEW.owner_profile_id;
  v_recent_window interval := interval '10 minutes';
  v_daily_limit integer := 10;
  v_recent_limit integer := 3;
  recent_count integer;
  daily_count integer;
BEGIN
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.baskets b
  WHERE b.owner_profile_id = v_owner
    AND b.created_at >= timezone('utc', now()) - v_recent_window;

  IF recent_count >= v_recent_limit THEN
    RAISE EXCEPTION 'basket_create_rate_limit'
      USING MESSAGE = 'You are creating baskets too quickly. Try again later.';
  END IF;

  SELECT count(*) INTO daily_count
  FROM public.baskets b
  WHERE b.owner_profile_id = v_owner
    AND b.created_at >= date_trunc('day', timezone('utc', now()));

  IF daily_count >= v_daily_limit THEN
    RAISE EXCEPTION 'basket_create_daily_limit'
      USING MESSAGE = 'You have reached the daily basket creation limit.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_baskets_rate_limit ON public.baskets;
CREATE TRIGGER trg_baskets_rate_limit
  BEFORE INSERT ON public.baskets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_assert_basket_create_rate_limit();

-- Rate limit trigger for basket joins (insert/update on basket_joins)
CREATE OR REPLACE FUNCTION public.fn_assert_basket_join_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_contact text := COALESCE(NEW.whatsapp, OLD.whatsapp, '');
  v_user uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_window_start timestamptz := timezone('utc', now()) - interval '5 minutes';
  v_current_id uuid := COALESCE(NEW.id, OLD.id);
  attempt_count integer;
BEGIN
  IF v_user IS NULL AND v_contact = '' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO attempt_count
  FROM public.basket_joins bj
  WHERE bj.created_at >= v_window_start
    AND (v_current_id IS NULL OR bj.id <> v_current_id)
    AND (
      (v_user IS NOT NULL AND bj.user_id = v_user)
      OR (v_contact <> '' AND bj.whatsapp = v_contact)
    );

  IF attempt_count >= 5 THEN
    RAISE EXCEPTION 'basket_join_rate_limit'
      USING MESSAGE = 'Too many join attempts. Wait a few minutes and try again.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := timezone('utc', now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_basket_joins_rate_limit_insert ON public.basket_joins;
CREATE TRIGGER trg_basket_joins_rate_limit_insert
  BEFORE INSERT ON public.basket_joins
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_assert_basket_join_rate_limit();

DROP TRIGGER IF EXISTS trg_basket_joins_rate_limit_update ON public.basket_joins;
CREATE TRIGGER trg_basket_joins_rate_limit_update
  BEFORE UPDATE ON public.basket_joins
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_assert_basket_join_rate_limit();

-- Refresh basket_create function to set join_token and ensure member linkage
CREATE OR REPLACE FUNCTION public.basket_create(
  _profile_id uuid,
  _whatsapp text,
  _name text,
  _is_public boolean,
  _goal_minor integer
)
RETURNS TABLE(basket_id uuid, share_token text, qr_url text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_basket_id uuid;
  v_token text;
  v_updated integer;
  v_now timestamptz := timezone('utc', now());
  v_whatsapp text := COALESCE(_whatsapp, '');
BEGIN
  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'basket_profile_required'
      USING MESSAGE = 'A profile is required to create a basket.';
  END IF;

  v_token := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO public.baskets (
    owner_profile_id,
    owner_whatsapp,
    creator_user_id,
    name,
    is_public,
    goal_minor,
    share_token,
    join_token,
    join_token_revoked,
    status,
    created_at,
    updated_at
  )
  VALUES (
    _profile_id,
    v_whatsapp,
    _profile_id,
    _name,
    COALESCE(_is_public, false),
    _goal_minor,
    v_token,
    v_token,
    false,
    'open',
    v_now,
    v_now
  )
  RETURNING id INTO v_basket_id;

  UPDATE public.basket_members
  SET profile_id = _profile_id,
      user_id = _profile_id,
      whatsapp = v_whatsapp,
      role = 'owner',
      joined_at = v_now,
      joined_via = 'create',
      join_reference = v_token
  WHERE basket_id = v_basket_id
    AND (
      (user_id IS NOT NULL AND user_id = _profile_id)
      OR COALESCE(whatsapp, '') = v_whatsapp
    )
  RETURNING 1 INTO v_updated;

  IF NOT FOUND THEN
    INSERT INTO public.basket_members (
      basket_id,
      profile_id,
      user_id,
      whatsapp,
      role,
      joined_at,
      joined_via,
      join_reference
    )
    VALUES (
      v_basket_id,
      _profile_id,
      _profile_id,
      v_whatsapp,
      'owner',
      v_now,
      'create',
      v_token
    );
  END IF;

  basket_id := v_basket_id;
  share_token := v_token;
  qr_url := 'https://quickchart.io/qr?text=JB:' || v_token;
  RETURN NEXT;
END;
$$;

-- Refresh basket_join_by_code to enforce throttles and track joins
CREATE OR REPLACE FUNCTION public.basket_join_by_code(
  _profile_id uuid,
  _whatsapp text,
  _code text
)
RETURNS TABLE(basket_id uuid, basket_name text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_token text;
  v_contact text := COALESCE(_whatsapp, '');
  v_basket public.baskets;
  v_now timestamptz := timezone('utc', now());
  v_updated integer;
BEGIN
  IF _code IS NULL OR length(trim(_code)) < 4 THEN
    RAISE EXCEPTION 'basket_code_invalid'
      USING MESSAGE = 'That join code looks invalid.';
  END IF;

  v_token := upper(regexp_replace(trim(_code), '^JB[:\-]?', ''));
  IF length(v_token) < 4 THEN
    RAISE EXCEPTION 'basket_code_invalid'
      USING MESSAGE = 'That join code looks invalid.';
  END IF;

  SELECT * INTO v_basket
  FROM public.baskets b
  WHERE COALESCE(b.join_token, b.share_token) = v_token
  LIMIT 1;

  IF v_basket.id IS NULL THEN
    RAISE EXCEPTION 'basket_code_not_found'
      USING MESSAGE = 'No basket found for that code.';
  END IF;

  IF COALESCE(v_basket.join_token_revoked, false) THEN
    RAISE EXCEPTION 'basket_code_revoked'
      USING MESSAGE = 'This join code has been revoked.';
  END IF;

  IF v_basket.status IS NULL OR v_basket.status::text <> 'open' THEN
    RAISE EXCEPTION 'basket_not_joinable'
      USING MESSAGE = 'This basket is not accepting new members.';
  END IF;

  INSERT INTO public.basket_joins (
    basket_id,
    whatsapp,
    user_id,
    invite_source,
    status,
    metadata,
    created_at,
    processed_at
  )
  VALUES (
    v_basket.id,
    NULLIF(v_contact, ''),
    _profile_id,
    'code',
    'joined',
    jsonb_build_object('token', v_token),
    v_now,
    v_now
  )
  ON CONFLICT ON CONSTRAINT idx_basket_joins_unique DO UPDATE
  SET user_id = COALESCE(EXCLUDED.user_id, public.basket_joins.user_id),
      whatsapp = EXCLUDED.whatsapp,
      invite_source = 'code',
      status = 'joined',
      metadata = jsonb_strip_nulls(public.basket_joins.metadata || EXCLUDED.metadata),
      processed_at = v_now;

  UPDATE public.basket_members
  SET profile_id = COALESCE(_profile_id, profile_id),
      user_id = COALESCE(_profile_id, user_id),
      whatsapp = v_contact,
      role = CASE WHEN role = 'owner' THEN role ELSE 'member' END,
      joined_at = v_now,
      joined_via = 'code',
      join_reference = v_token
  WHERE basket_id = v_basket.id
    AND (
      (user_id IS NOT NULL AND _profile_id IS NOT NULL AND user_id = _profile_id)
      OR COALESCE(whatsapp, '') = v_contact
    )
  RETURNING 1 INTO v_updated;

  IF NOT FOUND THEN
    INSERT INTO public.basket_members (
      basket_id,
      profile_id,
      user_id,
      whatsapp,
      role,
      joined_at,
      joined_via,
      join_reference
    )
    VALUES (
      v_basket.id,
      _profile_id,
      _profile_id,
      v_contact,
      'member',
      v_now,
      'code',
      v_token
    );
  END IF;

  basket_id := v_basket.id;
  basket_name := v_basket.name;
  RETURN NEXT;
END;
$$;

COMMIT;
