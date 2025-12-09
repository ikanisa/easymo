-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: SACCO payment processing functions
-- ═══════════════════════════════════════════════════════════════════════════
-- Database functions for SACCO payment matching and processing
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Register a SACCO webhook endpoint
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.register_sacco_webhook(
    p_sacco_id UUID,
    p_phone_number TEXT,
    p_webhook_secret TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_endpoint_id UUID;
    v_secret TEXT;
BEGIN
    -- Generate secret if not provided
    v_secret := COALESCE(p_webhook_secret, encode(gen_random_bytes(32), 'hex'));

    -- Normalize phone number (remove spaces, dashes)
    p_phone_number := regexp_replace(p_phone_number, '[^0-9+]', '', 'g');

    -- Insert or update endpoint
    INSERT INTO public.momo_webhook_endpoints (
        momo_phone_number,
        service_type,
        sacco_id,
        webhook_secret,
        active,
        description,
        created_at,
        updated_at
    ) VALUES (
        p_phone_number,
        'sacco',
        p_sacco_id,
        v_secret,
        true,
        COALESCE(p_description, 'SACCO MoMo receiving number'),
        NOW(),
        NOW()
    )
    ON CONFLICT (momo_phone_number) DO UPDATE SET
        service_type = 'sacco',
        sacco_id = p_sacco_id,
        webhook_secret = v_secret,
        active = true,
        description = COALESCE(p_description, momo_webhook_endpoints.description),
        updated_at = NOW()
    RETURNING id INTO v_endpoint_id;

    RETURN v_endpoint_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Get SACCO for a phone number
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.get_sacco_for_phone(p_phone_number TEXT)
RETURNS TABLE (
    sacco_id UUID,
    sacco_name TEXT,
    endpoint_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Normalize phone number
    p_phone_number := regexp_replace(p_phone_number, '[^0-9+]', '', 'g');

    RETURN QUERY
    SELECT
        e.sacco_id,
        s.name AS sacco_name,
        e.id AS endpoint_id
    FROM public.momo_webhook_endpoints e
    JOIN app.saccos s ON s.id = e.sacco_id
    WHERE e.momo_phone_number = p_phone_number
    AND e.service_type = 'sacco'
    AND e.active = true
    AND s.status = 'ACTIVE'
    LIMIT 1;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Match SMS sender to member by phone hash
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.match_member_by_phone(
    p_sacco_id UUID,
    p_phone TEXT
)
RETURNS TABLE (
    member_id UUID,
    member_name TEXT,
    member_code TEXT,
    ikimina_id UUID,
    ikimina_name TEXT,
    confidence DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_phone_normalized TEXT;
    v_phone_hash TEXT;
BEGIN
    -- Normalize phone: remove non-digits, take last 9 digits
    v_phone_normalized := RIGHT(regexp_replace(p_phone, '\D', '', 'g'), 9);

    -- Create SHA-256 hash
    v_phone_hash := encode(sha256(v_phone_normalized::bytea), 'hex');

    -- Try exact match by phone hash
    RETURN QUERY
    SELECT
        m.id AS member_id,
        m.full_name AS member_name,
        m.member_code,
        m.ikimina_id,
        i.name AS ikimina_name,
        1.0::DOUBLE PRECISION AS confidence
    FROM app.members m
    LEFT JOIN app.ikimina i ON i.id = m.ikimina_id
    WHERE m.sacco_id = p_sacco_id
    AND m.msisdn_hash = v_phone_hash
    AND m.status = 'ACTIVE'
    LIMIT 1;

    -- If no results, also try with full phone hash (in case stored differently)
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            m.id AS member_id,
            m.full_name AS member_name,
            m.member_code,
            m.ikimina_id,
            i.name AS ikimina_name,
            0.9::DOUBLE PRECISION AS confidence
        FROM app.members m
        LEFT JOIN app.ikimina i ON i.id = m.ikimina_id
        WHERE m.sacco_id = p_sacco_id
        AND m.msisdn_hash = encode(sha256(p_phone::bytea), 'hex')
        AND m.status = 'ACTIVE'
        LIMIT 1;
    END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Match SMS sender to member by name (fuzzy)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.match_member_by_name(
    p_sacco_id UUID,
    p_name TEXT
)
RETURNS TABLE (
    member_id UUID,
    member_name TEXT,
    member_code TEXT,
    ikimina_id UUID,
    ikimina_name TEXT,
    confidence DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name_normalized TEXT;
BEGIN
    -- Normalize name: uppercase, remove extra spaces
    v_name_normalized := UPPER(TRIM(regexp_replace(p_name, '\s+', ' ', 'g')));

    -- Try exact match first
    RETURN QUERY
    SELECT
        m.id AS member_id,
        m.full_name AS member_name,
        m.member_code,
        m.ikimina_id,
        i.name AS ikimina_name,
        1.0::DOUBLE PRECISION AS confidence
    FROM app.members m
    LEFT JOIN app.ikimina i ON i.id = m.ikimina_id
    WHERE m.sacco_id = p_sacco_id
    AND UPPER(m.full_name) = v_name_normalized
    AND m.status = 'ACTIVE'
    LIMIT 1;

    -- If no exact match, try partial match
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            m.id AS member_id,
            m.full_name AS member_name,
            m.member_code,
            m.ikimina_id,
            i.name AS ikimina_name,
            0.7::DOUBLE PRECISION AS confidence
        FROM app.members m
        LEFT JOIN app.ikimina i ON i.id = m.ikimina_id
        WHERE m.sacco_id = p_sacco_id
        AND (
            UPPER(m.full_name) LIKE '%' || v_name_normalized || '%'
            OR v_name_normalized LIKE '%' || UPPER(m.full_name) || '%'
        )
        AND m.status = 'ACTIVE'
        ORDER BY
            CASE
                WHEN UPPER(m.full_name) = v_name_normalized THEN 0
                WHEN UPPER(m.full_name) LIKE v_name_normalized || '%' THEN 1
                WHEN UPPER(m.full_name) LIKE '%' || v_name_normalized THEN 2
                ELSE 3
            END
        LIMIT 1;
    END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Process SACCO payment with balance update
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.process_sacco_payment(
    p_sacco_id UUID,
    p_member_id UUID,
    p_amount INTEGER,
    p_reference TEXT,
    p_payment_method TEXT DEFAULT 'momo',
    p_sms_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (
    payment_id UUID,
    account_id UUID,
    new_balance INTEGER,
    ledger_entry_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment_id UUID;
    v_account_id UUID;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_ledger_id UUID;
    v_ikimina_id UUID;
BEGIN
    -- Get member's ikimina
    SELECT ikimina_id INTO v_ikimina_id
    FROM app.members
    WHERE id = p_member_id;

    -- Get or create member's savings account
    SELECT id, COALESCE(balance, 0) INTO v_account_id, v_current_balance
    FROM app.accounts
    WHERE member_id = p_member_id
    AND account_type = 'savings'
    AND status = 'ACTIVE';

    IF v_account_id IS NULL THEN
        INSERT INTO app.accounts (
            sacco_id,
            ikimina_id,
            member_id,
            account_type,
            balance,
            currency,
            status,
            created_at,
            updated_at
        ) VALUES (
            p_sacco_id,
            v_ikimina_id,
            p_member_id,
            'savings',
            0,
            'RWF',
            'ACTIVE',
            NOW(),
            NOW()
        )
        RETURNING id, balance INTO v_account_id, v_current_balance;
    END IF;

    -- Calculate new balance
    v_new_balance := v_current_balance + p_amount;

    -- Create payment record
    INSERT INTO app.payments (
        sacco_id,
        ikimina_id,
        member_id,
        account_id,
        amount,
        currency,
        payment_method,
        reference,
        status,
        confidence,
        sms_id,
        metadata,
        created_at,
        processed_at
    ) VALUES (
        p_sacco_id,
        v_ikimina_id,
        p_member_id,
        v_account_id,
        p_amount,
        'RWF',
        p_payment_method,
        p_reference,
        'matched',
        1.0,
        p_sms_id,
        p_metadata,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_payment_id;

    -- Update account balance
    UPDATE app.accounts
    SET
        balance = v_new_balance,
        updated_at = NOW()
    WHERE id = v_account_id;

    -- Create ledger entry (credit to member account)
    INSERT INTO app.ledger_entries (
        sacco_id,
        credit_id,
        amount,
        value_date,
        description,
        reference,
        created_at
    ) VALUES (
        p_sacco_id,
        v_account_id,
        p_amount,
        NOW(),
        'MoMo payment received',
        p_reference,
        NOW()
    )
    RETURNING id INTO v_ledger_id;

    RETURN QUERY SELECT v_payment_id, v_account_id, v_new_balance, v_ledger_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Store SMS in inbox
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.store_sms_inbox(
    p_sacco_id UUID,
    p_sender TEXT,
    p_message TEXT,
    p_parsed_data JSONB DEFAULT NULL,
    p_received_at TIMESTAMPTZ DEFAULT NOW(),
    p_momo_transaction_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sms_id UUID;
BEGIN
    INSERT INTO app.sms_inbox (
        sacco_id,
        momo_transaction_id,
        sender,
        message,
        received_at,
        parsed_data,
        status,
        created_at
    ) VALUES (
        p_sacco_id,
        p_momo_transaction_id,
        p_sender,
        p_message,
        p_received_at,
        p_parsed_data,
        'pending',
        NOW()
    )
    RETURNING id INTO v_sms_id;

    RETURN v_sms_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Update SMS inbox with match result
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.update_sms_match(
    p_sms_id UUID,
    p_member_id UUID DEFAULT NULL,
    p_payment_id UUID DEFAULT NULL,
    p_confidence DOUBLE PRECISION DEFAULT NULL,
    p_status TEXT DEFAULT 'matched'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE app.sms_inbox
    SET
        matched_member_id = COALESCE(p_member_id, matched_member_id),
        matched_payment_id = COALESCE(p_payment_id, matched_payment_id),
        confidence = COALESCE(p_confidence, confidence),
        status = p_status
    WHERE id = p_sms_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Manual match SMS to member
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.manual_match_sms(
    p_sms_id UUID,
    p_member_id UUID,
    p_matched_by UUID DEFAULT NULL
)
RETURNS TABLE (
    payment_id UUID,
    amount INTEGER,
    member_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sms RECORD;
    v_member RECORD;
    v_payment_id UUID;
    v_amount INTEGER;
BEGIN
    -- Get SMS record
    SELECT * INTO v_sms
    FROM app.sms_inbox
    WHERE id = p_sms_id
    AND status = 'unmatched';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SMS not found or already matched';
    END IF;

    -- Get member record
    SELECT * INTO v_member
    FROM app.members
    WHERE id = p_member_id
    AND sacco_id = v_sms.sacco_id
    AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Member not found or inactive';
    END IF;

    -- Extract amount from parsed data
    v_amount := COALESCE((v_sms.parsed_data->>'amount')::INTEGER, 0);

    IF v_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid payment amount';
    END IF;

    -- Process the payment
    SELECT p.payment_id INTO v_payment_id
    FROM app.process_sacco_payment(
        v_sms.sacco_id,
        p_member_id,
        v_amount,
        v_sms.parsed_data->>'transaction_id',
        COALESCE(v_sms.parsed_data->>'provider', 'momo'),
        p_sms_id,
        jsonb_build_object(
            'manual_match', true,
            'matched_by', p_matched_by,
            'matched_at', NOW()
        )
    ) p;

    -- Update SMS status
    PERFORM app.update_sms_match(
        p_sms_id,
        p_member_id,
        v_payment_id,
        1.0,
        'matched'
    );

    RETURN QUERY SELECT v_payment_id, v_amount, v_member.full_name;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Get payment statistics for a SACCO
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.get_payment_stats(
    p_sacco_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_payments BIGINT,
    total_amount BIGINT,
    matched_count BIGINT,
    unmatched_count BIGINT,
    today_payments BIGINT,
    today_amount BIGINT,
    match_rate DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_today_start TIMESTAMPTZ;
BEGIN
    v_start_date := NOW() - (p_days || ' days')::INTERVAL;
    v_today_start := DATE_TRUNC('day', NOW());

    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_payments,
        COALESCE(SUM(p.amount), 0)::BIGINT AS total_amount,
        COUNT(*) FILTER (WHERE p.status = 'matched')::BIGINT AS matched_count,
        (SELECT COUNT(*) FROM app.sms_inbox s WHERE s.sacco_id = p_sacco_id AND s.status = 'unmatched')::BIGINT AS unmatched_count,
        COUNT(*) FILTER (WHERE p.created_at >= v_today_start)::BIGINT AS today_payments,
        COALESCE(SUM(p.amount) FILTER (WHERE p.created_at >= v_today_start), 0)::BIGINT AS today_amount,
        CASE
            WHEN COUNT(*) > 0 THEN
                (COUNT(*) FILTER (WHERE p.status = 'matched')::DOUBLE PRECISION / COUNT(*)::DOUBLE PRECISION) * 100
            ELSE 0
        END AS match_rate
    FROM app.payments p
    WHERE p.sacco_id = p_sacco_id
    AND p.created_at >= v_start_date;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION app.register_sacco_webhook TO service_role;
GRANT EXECUTE ON FUNCTION app.get_sacco_for_phone TO service_role;
GRANT EXECUTE ON FUNCTION app.match_member_by_phone TO service_role;
GRANT EXECUTE ON FUNCTION app.match_member_by_name TO service_role;
GRANT EXECUTE ON FUNCTION app.process_sacco_payment TO service_role;
GRANT EXECUTE ON FUNCTION app.store_sms_inbox TO service_role;
GRANT EXECUTE ON FUNCTION app.update_sms_match TO service_role;
GRANT EXECUTE ON FUNCTION app.manual_match_sms TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.get_payment_stats TO service_role, authenticated;

-- Comments
COMMENT ON FUNCTION app.register_sacco_webhook IS 'Register a phone number as a SACCO webhook endpoint';
COMMENT ON FUNCTION app.get_sacco_for_phone IS 'Get the SACCO associated with a MoMo phone number';
COMMENT ON FUNCTION app.match_member_by_phone IS 'Match a member by phone number hash';
COMMENT ON FUNCTION app.match_member_by_name IS 'Match a member by name (fuzzy matching)';
COMMENT ON FUNCTION app.process_sacco_payment IS 'Process a SACCO payment with balance update and ledger entry';
COMMENT ON FUNCTION app.store_sms_inbox IS 'Store an SMS in the inbox for processing';
COMMENT ON FUNCTION app.update_sms_match IS 'Update SMS inbox with match result';
COMMENT ON FUNCTION app.manual_match_sms IS 'Manually match an unmatched SMS to a member';
COMMENT ON FUNCTION app.get_payment_stats IS 'Get payment statistics for a SACCO';

COMMIT;
