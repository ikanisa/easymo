-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Member Analytics Functions
-- Description: Member statistics, payment history, and activity tracking
-- Created: 2025-12-09
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Get member summary (profile with stats)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.get_member_summary(p_member_id UUID)
RETURNS TABLE (
    member_id UUID,
    member_code TEXT,
    full_name TEXT,
    msisdn_masked TEXT,
    email TEXT,
    status TEXT,
    joined_at TIMESTAMPTZ,
    ikimina_id UUID,
    ikimina_name TEXT,
    total_balance BIGINT,
    total_payments BIGINT,
    total_paid BIGINT,
    last_payment_date TIMESTAMPTZ,
    payment_count_30d INTEGER,
    average_payment BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id AS member_id,
        m.member_code,
        m.full_name,
        m.msisdn_masked,
        m.email,
        m.status::TEXT,
        m.joined_at,
        m.ikimina_id,
        i.name AS ikimina_name,
        COALESCE(SUM(a.balance), 0)::BIGINT AS total_balance,
        COUNT(DISTINCT p.id)::BIGINT AS total_payments,
        COALESCE(SUM(p.amount), 0)::BIGINT AS total_paid,
        MAX(p.created_at) AS last_payment_date,
        COUNT(DISTINCT p.id) FILTER (WHERE p.created_at >= NOW() - INTERVAL '30 days')::INTEGER AS payment_count_30d,
        CASE
            WHEN COUNT(DISTINCT p.id) > 0 THEN (COALESCE(SUM(p.amount), 0) / COUNT(DISTINCT p.id))::BIGINT
            ELSE 0
        END AS average_payment
    FROM app.members m
    LEFT JOIN app.ikimina i ON i.id = m.ikimina_id
    LEFT JOIN app.accounts a ON a.member_id = m.id AND a.status = 'ACTIVE'
    LEFT JOIN app.payments p ON p.member_id = m.id AND p.status = 'matched'
    WHERE m.id = p_member_id
    GROUP BY m.id, i.id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Get member payment history
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.get_member_payment_history(
    p_member_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    payment_id UUID,
    amount INTEGER,
    currency TEXT,
    payment_method TEXT,
    reference TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    account_type TEXT,
    running_balance BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS payment_id,
        p.amount,
        p.currency,
        p.payment_method,
        p.reference,
        p.status::TEXT,
        p.created_at,
        a.account_type::TEXT,
        SUM(p.amount) OVER (ORDER BY p.created_at ASC)::BIGINT AS running_balance
    FROM app.payments p
    LEFT JOIN app.accounts a ON a.id = p.account_id
    WHERE p.member_id = p_member_id
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Get member account transactions (ledger view)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.get_member_transactions(
    p_member_id UUID,
    p_account_type TEXT DEFAULT NULL,
    p_from_date TIMESTAMPTZ DEFAULT NULL,
    p_to_date TIMESTAMPTZ DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    transaction_id UUID,
    account_id UUID,
    account_type TEXT,
    amount INTEGER,
    direction TEXT,
    balance_after BIGINT,
    description TEXT,
    reference TEXT,
    value_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN QUERY
    WITH member_accounts AS (
        SELECT a.id, a.account_type
        FROM app.accounts a
        WHERE a.member_id = p_member_id
        AND (p_account_type IS NULL OR a.account_type::TEXT = p_account_type)
    ),
    ledger AS (
        SELECT
            le.id AS transaction_id,
            COALESCE(le.credit_id, le.debit_id) AS account_id,
            ma.account_type::TEXT AS account_type,
            le.amount,
            CASE WHEN le.credit_id IS NOT NULL THEN 'credit' ELSE 'debit' END AS direction,
            le.description,
            le.reference,
            le.value_date,
            le.created_at
        FROM app.ledger_entries le
        JOIN member_accounts ma ON ma.id = COALESCE(le.credit_id, le.debit_id)
        WHERE (p_from_date IS NULL OR le.value_date >= p_from_date)
        AND (p_to_date IS NULL OR le.value_date <= p_to_date)
    )
    SELECT
        l.transaction_id,
        l.account_id,
        l.account_type,
        l.amount,
        l.direction,
        SUM(
            CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END
        ) OVER (PARTITION BY l.account_id ORDER BY l.value_date ASC, l.created_at ASC)::BIGINT AS balance_after,
        l.description,
        l.reference,
        l.value_date,
        l.created_at
    FROM ledger l
    ORDER BY l.value_date DESC, l.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Get group member statistics
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.get_group_member_stats(p_ikimina_id UUID)
RETURNS TABLE (
    total_members BIGINT,
    active_members BIGINT,
    inactive_members BIGINT,
    total_savings BIGINT,
    average_savings BIGINT,
    total_payments_30d BIGINT,
    top_savers JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN QUERY
    WITH member_balances AS (
        SELECT
            m.id AS member_id,
            m.full_name,
            m.status,
            COALESCE(SUM(a.balance), 0) AS balance
        FROM app.members m
        LEFT JOIN app.accounts a ON a.member_id = m.id AND a.status = 'ACTIVE'
        WHERE m.ikimina_id = p_ikimina_id
        AND m.status != 'DELETED'
        GROUP BY m.id
    ),
    payment_stats AS (
        SELECT COALESCE(SUM(p.amount), 0) AS total_30d
        FROM app.payments p
        JOIN app.members m ON m.id = p.member_id
        WHERE m.ikimina_id = p_ikimina_id
        AND p.status = 'matched'
        AND p.created_at >= NOW() - INTERVAL '30 days'
    ),
    top_members AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'member_id', mb.member_id,
                'full_name', mb.full_name,
                'balance', mb.balance
            ) ORDER BY mb.balance DESC
        ) AS top_list
        FROM (
            SELECT * FROM member_balances
            WHERE status = 'ACTIVE'
            ORDER BY balance DESC
            LIMIT 5
        ) mb
    )
    SELECT
        COUNT(*)::BIGINT AS total_members,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::BIGINT AS active_members,
        COUNT(*) FILTER (WHERE status = 'INACTIVE')::BIGINT AS inactive_members,
        COALESCE(SUM(balance), 0)::BIGINT AS total_savings,
        CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'ACTIVE') > 0 
            THEN (COALESCE(SUM(balance) FILTER (WHERE status = 'ACTIVE'), 0) / COUNT(*) FILTER (WHERE status = 'ACTIVE'))::BIGINT
            ELSE 0
        END AS average_savings,
        (SELECT total_30d FROM payment_stats)::BIGINT AS total_payments_30d,
        COALESCE((SELECT top_list FROM top_members), '[]'::JSONB) AS top_savers
    FROM member_balances;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Get member activity timeline
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.get_member_activity(
    p_member_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    activity_id TEXT,
    activity_type TEXT,
    description TEXT,
    amount INTEGER,
    reference_id UUID,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN QUERY
    (
        -- Payments
        SELECT
            'payment_' || p.id::TEXT AS activity_id,
            'payment'::TEXT AS activity_type,
            'Payment received via ' || COALESCE(p.payment_method, 'unknown')::TEXT AS description,
            p.amount,
            p.id AS reference_id,
            p.created_at
        FROM app.payments p
        WHERE p.member_id = p_member_id
        AND p.status = 'matched'
    )
    UNION ALL
    (
        -- Account changes (from ledger)
        SELECT
            'ledger_' || le.id::TEXT AS activity_id,
            CASE WHEN le.credit_id IS NOT NULL THEN 'credit' ELSE 'debit' END::TEXT AS activity_type,
            le.description::TEXT,
            le.amount,
            le.id AS reference_id,
            le.created_at
        FROM app.ledger_entries le
        JOIN app.accounts a ON a.id = COALESCE(le.credit_id, le.debit_id)
        WHERE a.member_id = p_member_id
    )
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Grant permissions
-- ═══════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION app.get_member_summary TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.get_member_payment_history TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.get_member_transactions TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.get_group_member_stats TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.get_member_activity TO service_role, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Comments
-- ═══════════════════════════════════════════════════════════════════════════
COMMENT ON FUNCTION app.get_member_summary IS 'Get member profile with aggregated statistics';
COMMENT ON FUNCTION app.get_member_payment_history IS 'Get paginated payment history for a member';
COMMENT ON FUNCTION app.get_member_transactions IS 'Get ledger transactions for a member';
COMMENT ON FUNCTION app.get_group_member_stats IS 'Get aggregate statistics for a group';
COMMENT ON FUNCTION app.get_member_activity IS 'Get activity timeline for a member';

COMMIT;
