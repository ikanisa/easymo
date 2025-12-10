-- Agent RPC functions for OpenAI Responses integration
-- Provides scoped access to knowledge base, allocations, reference tokens, and ticket creation.

SET search_path TO public;

-- Helper: assert whether a user can access an organisation
CREATE OR REPLACE FUNCTION public.agent_assert_org_access(p_user UUID, p_org UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  has_membership BOOLEAN := FALSE;
BEGIN
  IF p_org IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT TRUE
    INTO has_membership
  FROM public.org_memberships om
  WHERE om.user_id = p_user
    AND om.org_id = p_org
  LIMIT 1;

  IF has_membership THEN
    RETURN TRUE;
  END IF;

  SELECT TRUE
    INTO has_membership
  FROM public.user_saccos us
  JOIN public.saccos s
    ON s.id = us.sacco_id
  WHERE us.user_id = p_user
    AND s.org_id = p_org
  LIMIT 1;

  RETURN COALESCE(has_membership, FALSE);
END;
$$;

COMMENT ON FUNCTION public.agent_assert_org_access IS 'Return true when the user has membership to the provided organisation.';

-- Resolve effective organisation scope for a user
CREATE OR REPLACE FUNCTION public.agent_resolve_org_scope(p_user UUID, p_org UUID)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  country_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  target_org UUID;
BEGIN
  IF p_org IS NOT NULL AND public.agent_assert_org_access(p_user, p_org) THEN
    target_org := p_org;
  ELSE
    SELECT om.org_id
      INTO target_org
    FROM public.org_memberships om
    WHERE om.user_id = p_user
    ORDER BY om.created_at
    LIMIT 1;

    IF target_org IS NULL THEN
      SELECT s.org_id
        INTO target_org
      FROM public.user_saccos us
      JOIN public.saccos s
        ON s.id = us.sacco_id
      WHERE us.user_id = p_user
      ORDER BY us.created_at
      LIMIT 1;
    END IF;
  END IF;

  IF target_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT o.id,
         o.name,
         COALESCE(c.iso2, c.iso3, 'RW')
  FROM public.organizations o
  LEFT JOIN public.countries c
    ON c.id = o.country_id
  WHERE o.id = target_org;
END;
$$;

COMMENT ON FUNCTION public.agent_resolve_org_scope IS 'Resolve the organisation (and country) a user is scoped to for agent requests.';

-- Knowledge base semantic search (org + global)
CREATE OR REPLACE FUNCTION public.agent_kb_search(
  p_user UUID,
  query_embedding vector,
  query_text TEXT,
  target_org UUID DEFAULT NULL,
  language_filter TEXT DEFAULT NULL,
  match_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  source TEXT,
  record_id UUID,
  org_id UUID,
  title TEXT,
  content TEXT,
  language_code TEXT,
  similarity DOUBLE PRECISION,
  tags TEXT[],
  policy_tag TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_org UUID;
  limit_rows INTEGER := GREATEST(1, LEAST(COALESCE(match_limit, 5), 20));
BEGIN
  IF query_embedding IS NULL THEN
    RAISE EXCEPTION 'query_embedding is required';
  END IF;

  SELECT scope.org_id
    INTO effective_org
  FROM public.agent_resolve_org_scope(p_user, target_org) AS scope
  LIMIT 1;

  RETURN QUERY
  WITH org_matches AS (
    SELECT
      'org_kb'::TEXT AS source,
      o.id AS record_id,
      o.org_id,
      o.title,
      o.content,
      o.language_code,
      1 - (o.embedding <=> query_embedding) AS similarity,
      o.tags,
      o.policy_tag
    FROM public.org_kb o
    WHERE o.embedding IS NOT NULL
      AND effective_org IS NOT NULL
      AND o.org_id = effective_org
      AND (language_filter IS NULL OR o.language_code = language_filter)
    ORDER BY o.embedding <=> query_embedding
    LIMIT limit_rows
  ),
  global_matches AS (
    SELECT
      'global_kb'::TEXT AS source,
      g.id AS record_id,
      NULL::UUID AS org_id,
      g.title,
      g.content,
      g.language_code,
      1 - (g.embedding <=> query_embedding) AS similarity,
      g.tags,
      g.policy_tag
    FROM public.global_kb g
    WHERE g.embedding IS NOT NULL
      AND (language_filter IS NULL OR g.language_code = language_filter)
    ORDER BY g.embedding <=> query_embedding
    LIMIT limit_rows
  ),
  lexical_matches AS (
    SELECT
      'org_kb'::TEXT AS source,
      o.id AS record_id,
      o.org_id,
      o.title,
      o.content,
      o.language_code,
      LEAST(0.75, ts_rank_cd(to_tsvector('simple', o.content), plainto_tsquery('simple', query_text))) AS similarity,
      o.tags,
      o.policy_tag
    FROM public.org_kb o
    WHERE effective_org IS NOT NULL
      AND o.org_id = effective_org
      AND query_text IS NOT NULL
      AND query_text <> ''
    ORDER BY similarity DESC
    LIMIT 3
  ),
  combined AS (
    SELECT * FROM org_matches
    UNION ALL
    SELECT * FROM global_matches
    UNION ALL
    SELECT * FROM lexical_matches
  )
  SELECT
    source,
    record_id,
    org_id,
    title,
    content,
    language_code,
    similarity,
    tags,
    policy_tag
  FROM combined
  ORDER BY similarity DESC
  LIMIT limit_rows;
END;
$$;

COMMENT ON FUNCTION public.agent_kb_search IS 'Return the most relevant knowledge base articles for an agent prompt.';

-- Ensure member_reference_tokens exists for reference generation
CREATE TABLE IF NOT EXISTS public.member_reference_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  member_id UUID,
  token TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'app',
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_member_reference_tokens_user ON public.member_reference_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_member_reference_tokens_org ON public.member_reference_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_member_reference_tokens_expires ON public.member_reference_tokens(expires_at);

ALTER TABLE public.member_reference_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_reference_tokens'
      AND policyname = 'members_can_read_own_reference_tokens'
  ) THEN
    CREATE POLICY members_can_read_own_reference_tokens
      ON public.member_reference_tokens
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allocation lookup for the authenticated user
CREATE OR REPLACE FUNCTION public.agent_allocations_read_mine(
  p_user UUID,
  p_reference_token TEXT,
  p_org UUID DEFAULT NULL,
  p_include_pending BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  allocation_id UUID,
  org_id UUID,
  amount NUMERIC,
  status TEXT,
  allocated_at TIMESTAMPTZ,
  group_name TEXT,
  reference TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  effective_org UUID;
  limit_rows INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
  normalized_ref TEXT := NULLIF(trim(p_reference_token), '');
  is_authorized BOOLEAN;
BEGIN
  IF normalized_ref IS NULL THEN
    RAISE EXCEPTION 'reference_token is required';
  END IF;

  SELECT scope.org_id
    INTO effective_org
  FROM public.agent_resolve_org_scope(p_user, p_org) AS scope
  LIMIT 1;

  IF effective_org IS NULL THEN
    RAISE EXCEPTION 'org_scope_not_found';
  END IF;

  is_authorized := public.agent_assert_org_access(p_user, effective_org);
  IF NOT is_authorized THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS allocation_id,
    a.org_id,
    a.amount,
    a.match_status AS status,
    a.ts AS allocated_at,
    COALESCE(a.decoded_group, a.sacco_name, 'Unknown group') AS group_name,
    COALESCE(a.raw_ref, a.decoded_member, normalized_ref) AS reference
  FROM public.allocations a
  WHERE a.org_id = effective_org
    AND (
      a.raw_ref = normalized_ref
      OR a.decoded_member = normalized_ref
      OR a.decoded_group = normalized_ref
    )
    AND (
      p_include_pending
      OR LOWER(COALESCE(a.match_status, '')) IN ('allocated', 'posted', 'confirmed', 'matched')
    )
  ORDER BY a.ts DESC
  LIMIT limit_rows;
END;
$$;

COMMENT ON FUNCTION public.agent_allocations_read_mine IS 'Fetch allocation rows for the member reference token within the scoped organisation.';

-- Generate reference token scoped to organisation and country
CREATE OR REPLACE FUNCTION public.agent_reference_generate(
  p_user UUID,
  p_org UUID,
  p_channel TEXT DEFAULT 'app',
  p_purpose TEXT,
  p_member_id UUID DEFAULT NULL,
  p_expires_in_minutes INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  token TEXT,
  expires_at TIMESTAMPTZ,
  channel TEXT,
  purpose TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  effective_org UUID;
  country_id UUID;
  country_iso3 TEXT := 'RWA';
  district_code TEXT := 'GEN';
  sacco_code TEXT := 'ORG';
  group_code TEXT;
  member_seq INT;
  expires TIMESTAMPTZ;
  cleaned_name TEXT;
  parent_org UUID;
  attempt INT := 0;
  new_token TEXT;
BEGIN
  IF p_purpose IS NULL OR trim(p_purpose) = '' THEN
    RAISE EXCEPTION 'purpose is required';
  END IF;

  SELECT scope.org_id
    INTO effective_org
  FROM public.agent_resolve_org_scope(p_user, p_org) AS scope
  LIMIT 1;

  IF effective_org IS NULL THEN
    RAISE EXCEPTION 'org_scope_not_found';
  END IF;

  IF NOT public.agent_assert_org_access(p_user, effective_org) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  SELECT o.country_id, o.parent_id, o.name
    INTO country_id, parent_org, cleaned_name
  FROM public.organizations o
  LEFT JOIN public.countries c
    ON c.id = o.country_id
  WHERE o.id = effective_org;

  IF country_id IS NOT NULL THEN
    SELECT COALESCE(c.iso3, 'RWA')
      INTO country_iso3
    FROM public.countries c
    WHERE c.id = country_id
    LIMIT 1;
  END IF;

  IF parent_org IS NOT NULL THEN
    SELECT LEFT(COALESCE(parent.district_code, 'GEN'), 3)
      INTO district_code
    FROM public.organizations parent
    WHERE parent.id = parent_org;
  END IF;

  cleaned_name := REGEXP_REPLACE(COALESCE(cleaned_name, 'ORG'), '[^A-Za-z0-9]', '', 'g');
  sacco_code := UPPER(LPAD(SUBSTRING(cleaned_name FROM 1 FOR 3), 3, 'X'));

  expires := timezone('UTC', now())
    + COALESCE(
      CASE
        WHEN p_expires_in_minutes IS NULL THEN NULL
        ELSE make_interval(mins => p_expires_in_minutes)
      END,
      interval '240 minutes'
    );

  LOOP
    attempt := attempt + 1;
    group_code := LPAD(SUBSTRING(md5(random()::TEXT) FROM 1 FOR 4), 4, '0');
    member_seq := FLOOR(random() * 900)::INT + 100;

    new_token := public.generate_reference_token(
      country_iso3,
      UPPER(SUBSTRING(district_code FROM 1 FOR 3)),
      sacco_code,
      group_code,
      member_seq
    );

    BEGIN
      INSERT INTO public.member_reference_tokens (
        org_id,
        user_id,
        member_id,
        token,
        channel,
        purpose,
        expires_at,
        notes,
        metadata,
        created_by
      )
      VALUES (
        effective_org,
        p_user,
        p_member_id,
        new_token,
        LOWER(COALESCE(p_channel, 'app')),
        p_purpose,
        expires,
        p_notes,
        jsonb_build_object('generated_by_agent', TRUE),
        p_user
      );
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        EXIT WHEN attempt > 5;
    END;
  END LOOP;

  IF attempt > 5 THEN
    RAISE EXCEPTION 'reference_token_generation_failed';
  END IF;

  RETURN QUERY SELECT new_token, expires, LOWER(COALESCE(p_channel, 'app')), p_purpose;
END;
$$;

COMMENT ON FUNCTION public.agent_reference_generate IS 'Generate a scoped reference token and persist it for the member.';

-- Ticket creation helper for the agent
CREATE OR REPLACE FUNCTION public.agent_tickets_create(
  p_user UUID,
  p_org UUID,
  p_subject TEXT,
  p_summary TEXT,
  p_channel TEXT DEFAULT 'in_app',
  p_priority TEXT DEFAULT 'normal',
  p_reference_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  ticket_id UUID,
  org_id UUID,
  reference TEXT,
  status TEXT,
  submitted_at TIMESTAMPTZ,
  summary TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  effective_org UUID;
  created_ticket UUID;
  status_value TEXT;
  created_at_ts TIMESTAMPTZ;
BEGIN
  IF p_subject IS NULL OR trim(p_subject) = '' THEN
    RAISE EXCEPTION 'subject is required';
  END IF;
  IF p_summary IS NULL OR trim(p_summary) = '' THEN
    RAISE EXCEPTION 'summary is required';
  END IF;

  SELECT scope.org_id
    INTO effective_org
  FROM public.agent_resolve_org_scope(p_user, p_org) AS scope
  LIMIT 1;

  IF effective_org IS NULL THEN
    RAISE EXCEPTION 'org_scope_not_found';
  END IF;

  IF NOT public.agent_assert_org_access(p_user, effective_org) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  INSERT INTO public.tickets (
    org_id,
    user_id,
    channel,
    subject,
    priority,
    status,
    meta
  )
  VALUES (
    effective_org,
    p_user,
    LOWER(COALESCE(p_channel, 'in_app')),
    p_subject,
    LOWER(COALESCE(p_priority, 'normal')),
    'open',
    jsonb_build_object('reference_token', p_reference_token)
  )
  RETURNING id, status, created_at INTO created_ticket, status_value, created_at_ts;

  RETURN QUERY
  SELECT
    created_ticket,
    effective_org,
    COALESCE(p_reference_token, created_ticket::TEXT),
    status_value,
    created_at_ts,
    p_summary;
END;
$$;

COMMENT ON FUNCTION public.agent_tickets_create IS 'Create a ticket for the scoped organisation on behalf of the authenticated user.';

GRANT EXECUTE ON FUNCTION public.agent_resolve_org_scope(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_kb_search(UUID, vector, TEXT, UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_allocations_read_mine(UUID, TEXT, UUID, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_reference_generate(UUID, UUID, TEXT, TEXT, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_tickets_create(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
