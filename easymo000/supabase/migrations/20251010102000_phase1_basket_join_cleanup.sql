-- Phase 1: retire basket_joins shadow table and inline rate limiting
BEGIN;

-- Recreate join RPC without basket_joins dependency
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
  v_joined public.basket_members;
  v_attempts integer;
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

  SELECT count(*) INTO v_attempts
  FROM public.basket_members bm
  WHERE bm.joined_at >= v_now - interval '5 minutes'
    AND (
      (_profile_id IS NOT NULL AND (bm.profile_id = _profile_id OR bm.user_id = _profile_id))
      OR (v_contact <> '' AND COALESCE(bm.whatsapp, '') = v_contact)
    );

  IF v_attempts >= 5 THEN
    RAISE EXCEPTION 'basket_join_rate_limit'
      USING MESSAGE = 'Too many join attempts. Wait a few minutes and try again.';
  END IF;

  UPDATE public.basket_members
  SET profile_id = COALESCE(_profile_id, profile_id),
      user_id = COALESCE(_profile_id, user_id),
      whatsapp = CASE WHEN v_contact = '' THEN whatsapp ELSE v_contact END,
      role = CASE WHEN role = 'owner' THEN role ELSE 'member' END,
      joined_at = v_now,
      joined_via = 'code',
      join_reference = v_token
  WHERE basket_id = v_basket.id
    AND (
      (_profile_id IS NOT NULL AND (profile_id = _profile_id OR user_id = _profile_id))
      OR (v_contact <> '' AND COALESCE(whatsapp, '') = v_contact)
    )
  RETURNING * INTO v_joined;

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
      NULLIF(v_contact, ''),
      'member',
      v_now,
      'code',
      v_token
    )
    RETURNING * INTO v_joined;
  END IF;

  basket_id := v_basket.id;
  basket_name := v_basket.name;
  RETURN NEXT;
END;
$$;

-- Remove legacy rate limit trigger/function and archive the table
DROP TRIGGER IF EXISTS trg_basket_joins_rate_limit_insert ON public.basket_joins;
DROP TRIGGER IF EXISTS trg_basket_joins_rate_limit_update ON public.basket_joins;
DROP POLICY IF EXISTS basket_joins_select_related ON public.basket_joins;
DROP FUNCTION IF EXISTS public.fn_assert_basket_join_rate_limit();

CREATE SCHEMA IF NOT EXISTS _archive AUTHORIZATION postgres;
COMMENT ON SCHEMA _archive IS 'Cold storage for decommissioned tables (Phase 1 refactor).';

ALTER TABLE IF EXISTS public.basket_joins SET SCHEMA _archive;
COMMENT ON TABLE _archive.basket_joins IS 'Archived legacy WA basket join staging table (Phase 1).';
ALTER TABLE IF EXISTS _archive.basket_joins DISABLE ROW LEVEL SECURITY;

COMMIT;
