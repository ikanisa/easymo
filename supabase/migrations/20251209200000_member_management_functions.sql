-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Member Management Functions
-- Description: Core member CRUD operations with PII protection
-- Created: 2025-12-09
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Generate unique member code
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.generate_member_code(
    p_sacco_id UUID,
    p_prefix TEXT DEFAULT 'MBR'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_sacco_code TEXT;
    v_sequence INTEGER;
    v_member_code TEXT;
BEGIN
    -- Get SACCO short code (first 3 chars of name, uppercase)
    SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g'), 3))
    INTO v_sacco_code
    FROM app.saccos
    WHERE id = p_sacco_id;

    IF v_sacco_code IS NULL THEN
        v_sacco_code := 'XXX';
    END IF;

    -- Get next sequence number for this SACCO
    SELECT COALESCE(MAX(
        NULLIF(REGEXP_REPLACE(member_code, '[^0-9]', '', 'g'), '')::INTEGER
    ), 0) + 1
    INTO v_sequence
    FROM app.members
    WHERE sacco_id = p_sacco_id;

    -- Format: PREFIX-SACCO-SEQUENCE (e.g., MBR-TWS-00001)
    v_member_code := p_prefix || '-' || v_sacco_code || '-' || LPAD(v_sequence::TEXT, 5, '0');

    RETURN v_member_code;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Create member with account
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.create_member(
    p_sacco_id UUID,
    p_ikimina_id UUID,
    p_full_name TEXT,
    p_phone TEXT,
    p_national_id TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_gender TEXT DEFAULT NULL,
    p_date_of_birth DATE DEFAULT NULL,
    p_address JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (
    member_id UUID,
    member_code TEXT,
    account_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_member_id UUID;
    v_member_code TEXT;
    v_account_id UUID;
    v_phone_normalized TEXT;
    v_phone_hash TEXT;
    v_phone_masked TEXT;
BEGIN
    -- Normalize phone number (take last 9 digits)
    v_phone_normalized := RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9);
    
    -- Create phone hash for matching
    v_phone_hash := encode(sha256(v_phone_normalized::bytea), 'hex');
    
    -- Create masked phone for display (e.g., 078****123)
    v_phone_masked := LEFT(v_phone_normalized, 3) || '****' || RIGHT(v_phone_normalized, 3);

    -- Generate member code
    v_member_code := app.generate_member_code(p_sacco_id);

    -- Check for duplicate phone in same SACCO
    IF EXISTS (
        SELECT 1 FROM app.members
        WHERE sacco_id = p_sacco_id
        AND msisdn_hash = v_phone_hash
        AND status != 'DELETED'
    ) THEN
        RAISE EXCEPTION 'Member with this phone number already exists in this SACCO';
    END IF;

    -- Check for duplicate national ID in same SACCO (if provided)
    IF p_national_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM app.members
        WHERE sacco_id = p_sacco_id
        AND national_id = p_national_id
        AND status != 'DELETED'
    ) THEN
        RAISE EXCEPTION 'Member with this National ID already exists in this SACCO';
    END IF;

    -- Create member
    INSERT INTO app.members (
        sacco_id,
        ikimina_id,
        member_code,
        full_name,
        msisdn_hash,
        msisdn_masked,
        national_id,
        email,
        gender,
        date_of_birth,
        address,
        status,
        joined_at,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        p_sacco_id,
        p_ikimina_id,
        v_member_code,
        p_full_name,
        v_phone_hash,
        v_phone_masked,
        p_national_id,
        p_email,
        p_gender,
        p_date_of_birth,
        COALESCE(p_address, '{}'::JSONB),
        'ACTIVE',
        NOW(),
        p_metadata,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_member_id;

    -- Create default savings account
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
        p_ikimina_id,
        v_member_id,
        'savings',
        0,
        'RWF',
        'ACTIVE',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_account_id;

    RETURN QUERY SELECT v_member_id, v_member_code, v_account_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Update member
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.update_member(
    p_member_id UUID,
    p_full_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_national_id TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_gender TEXT DEFAULT NULL,
    p_date_of_birth DATE DEFAULT NULL,
    p_address JSONB DEFAULT NULL,
    p_ikimina_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS app.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_member app.members;
    v_phone_normalized TEXT;
    v_phone_hash TEXT;
    v_phone_masked TEXT;
    v_sacco_id UUID;
BEGIN
    -- Get current member and SACCO ID
    SELECT sacco_id INTO v_sacco_id
    FROM app.members
    WHERE id = p_member_id;

    IF v_sacco_id IS NULL THEN
        RAISE EXCEPTION 'Member not found';
    END IF;

    -- Handle phone update
    IF p_phone IS NOT NULL THEN
        v_phone_normalized := RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9);
        v_phone_hash := encode(sha256(v_phone_normalized::bytea), 'hex');
        v_phone_masked := LEFT(v_phone_normalized, 3) || '****' || RIGHT(v_phone_normalized, 3);

        -- Check for duplicate phone
        IF EXISTS (
            SELECT 1 FROM app.members
            WHERE sacco_id = v_sacco_id
            AND msisdn_hash = v_phone_hash
            AND id != p_member_id
            AND status != 'DELETED'
        ) THEN
            RAISE EXCEPTION 'Another member with this phone number already exists';
        END IF;
    END IF;

    -- Check for duplicate national ID (if being updated)
    IF p_national_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM app.members
        WHERE sacco_id = v_sacco_id
        AND national_id = p_national_id
        AND id != p_member_id
        AND status != 'DELETED'
    ) THEN
        RAISE EXCEPTION 'Another member with this National ID already exists';
    END IF;

    -- Update member
    UPDATE app.members
    SET
        full_name = COALESCE(p_full_name, full_name),
        msisdn_hash = COALESCE(v_phone_hash, msisdn_hash),
        msisdn_masked = COALESCE(v_phone_masked, msisdn_masked),
        national_id = COALESCE(p_national_id, national_id),
        email = COALESCE(p_email, email),
        gender = COALESCE(p_gender, gender),
        date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
        address = COALESCE(p_address, address),
        ikimina_id = COALESCE(p_ikimina_id, ikimina_id),
        status = COALESCE(p_status, status),
        metadata = COALESCE(p_metadata, metadata),
        updated_at = NOW()
    WHERE id = p_member_id
    RETURNING * INTO v_member;

    -- If ikimina changed, update accounts too
    IF p_ikimina_id IS NOT NULL THEN
        UPDATE app.accounts
        SET ikimina_id = p_ikimina_id, updated_at = NOW()
        WHERE member_id = p_member_id;
    END IF;

    RETURN v_member;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Deactivate member (soft delete)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.deactivate_member(
    p_member_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    -- Check if member has outstanding balance
    SELECT COALESCE(SUM(balance), 0) INTO v_balance
    FROM app.accounts
    WHERE member_id = p_member_id
    AND status = 'ACTIVE';

    IF v_balance > 0 THEN
        RAISE EXCEPTION 'Cannot deactivate member with outstanding balance of % RWF', v_balance;
    END IF;

    -- Deactivate member
    UPDATE app.members
    SET
        status = 'INACTIVE',
        metadata = metadata || jsonb_build_object(
            'deactivated_at', NOW(),
            'deactivation_reason', p_reason
        ),
        updated_at = NOW()
    WHERE id = p_member_id;

    -- Deactivate all accounts
    UPDATE app.accounts
    SET status = 'INACTIVE', updated_at = NOW()
    WHERE member_id = p_member_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Bulk import members
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.bulk_import_members(
    p_sacco_id UUID,
    p_members JSONB
)
RETURNS TABLE (
    total_count INTEGER,
    success_count INTEGER,
    error_count INTEGER,
    errors JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_member JSONB;
    v_total INTEGER := 0;
    v_success INTEGER := 0;
    v_errors JSONB := '[]'::JSONB;
    v_row_num INTEGER := 0;
BEGIN
    FOR v_member IN SELECT * FROM jsonb_array_elements(p_members)
    LOOP
        v_row_num := v_row_num + 1;
        v_total := v_total + 1;

        BEGIN
            PERFORM app.create_member(
                p_sacco_id,
                (v_member->>'ikimina_id')::UUID,
                v_member->>'full_name',
                v_member->>'phone',
                v_member->>'national_id',
                v_member->>'email',
                v_member->>'gender',
                (v_member->>'date_of_birth')::DATE,
                (v_member->'address')::JSONB,
                COALESCE((v_member->'metadata')::JSONB, '{}'::JSONB)
            );
            v_success := v_success + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors || jsonb_build_object(
                'row', v_row_num,
                'name', v_member->>'full_name',
                'phone', v_member->>'phone',
                'error', SQLERRM
            );
        END;
    END LOOP;

    RETURN QUERY SELECT v_total, v_success, (v_total - v_success), v_errors;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Transfer member to another group
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.transfer_member_group(
    p_member_id UUID,
    p_new_ikimina_id UUID,
    p_transfer_balance BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_old_ikimina_id UUID;
    v_sacco_id UUID;
BEGIN
    -- Get current group
    SELECT ikimina_id, sacco_id INTO v_old_ikimina_id, v_sacco_id
    FROM app.members
    WHERE id = p_member_id;

    IF v_old_ikimina_id IS NULL THEN
        RAISE EXCEPTION 'Member not found';
    END IF;

    IF v_old_ikimina_id = p_new_ikimina_id THEN
        RAISE EXCEPTION 'Member is already in this group';
    END IF;

    -- Verify new group belongs to same SACCO
    IF NOT EXISTS (
        SELECT 1 FROM app.ikimina
        WHERE id = p_new_ikimina_id
        AND sacco_id = v_sacco_id
    ) THEN
        RAISE EXCEPTION 'Target group does not belong to the same SACCO';
    END IF;

    -- Update member
    UPDATE app.members
    SET
        ikimina_id = p_new_ikimina_id,
        metadata = metadata || jsonb_build_object(
            'transferred_from', v_old_ikimina_id,
            'transferred_at', NOW()
        ),
        updated_at = NOW()
    WHERE id = p_member_id;

    -- Update accounts if transfer_balance is true
    IF p_transfer_balance THEN
        UPDATE app.accounts
        SET ikimina_id = p_new_ikimina_id, updated_at = NOW()
        WHERE member_id = p_member_id;
    END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Function: Search members
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.search_members(
    p_sacco_id UUID,
    p_query TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    member_code TEXT,
    full_name TEXT,
    msisdn_masked TEXT,
    ikimina_name TEXT,
    status TEXT,
    relevance DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_query TEXT;
BEGIN
    v_query := LOWER(TRIM(p_query));

    RETURN QUERY
    SELECT
        m.id,
        m.member_code,
        m.full_name,
        m.msisdn_masked,
        i.name AS ikimina_name,
        m.status::TEXT,
        CASE
            WHEN LOWER(m.member_code) = v_query THEN 1.0
            WHEN LOWER(m.full_name) = v_query THEN 0.95
            WHEN LOWER(m.member_code) LIKE v_query || '%' THEN 0.9
            WHEN LOWER(m.full_name) LIKE v_query || '%' THEN 0.85
            WHEN LOWER(m.full_name) LIKE '%' || v_query || '%' THEN 0.7
            WHEN m.msisdn_masked LIKE '%' || v_query || '%' THEN 0.6
            ELSE 0.5
        END AS relevance
    FROM app.members m
    LEFT JOIN app.ikimina i ON i.id = m.ikimina_id
    WHERE m.sacco_id = p_sacco_id
    AND m.status != 'DELETED'
    AND (
        LOWER(m.member_code) LIKE '%' || v_query || '%'
        OR LOWER(m.full_name) LIKE '%' || v_query || '%'
        OR m.msisdn_masked LIKE '%' || v_query || '%'
    )
    ORDER BY relevance DESC, m.full_name ASC
    LIMIT p_limit;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Grant permissions
-- ═══════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION app.generate_member_code TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.create_member TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.update_member TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.deactivate_member TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.bulk_import_members TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.transfer_member_group TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.search_members TO service_role, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Comments
-- ═══════════════════════════════════════════════════════════════════════════
COMMENT ON FUNCTION app.generate_member_code IS 'Generate a unique member code for a SACCO';
COMMENT ON FUNCTION app.create_member IS 'Create a new member with default savings account';
COMMENT ON FUNCTION app.update_member IS 'Update member details';
COMMENT ON FUNCTION app.deactivate_member IS 'Soft delete a member (requires zero balance)';
COMMENT ON FUNCTION app.bulk_import_members IS 'Import multiple members from JSON array';
COMMENT ON FUNCTION app.transfer_member_group IS 'Transfer a member to another group';
COMMENT ON FUNCTION app.search_members IS 'Search members by code, name, or phone';

COMMIT;
