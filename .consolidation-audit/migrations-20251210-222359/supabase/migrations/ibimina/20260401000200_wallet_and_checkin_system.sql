-- Wallet & Token System + Visitor Check-in
-- Double-entry ledger with non-negative balance constraints
-- NFC-based visitor registration

-- ============================================================
-- WALLET SYSTEM: Token Management (non-custodial)
-- ============================================================

-- Wallet accounts (one per user, optional merchant wallets)
CREATE TABLE IF NOT EXISTS app.wallet_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES app.tapmomo_merchants(id) ON DELETE CASCADE,
    label TEXT,
    currency TEXT NOT NULL DEFAULT 'USDt' CHECK (char_length(currency) <= 10),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wallet_account_owner_or_merchant CHECK (
        (owner_user IS NOT NULL AND merchant_id IS NULL) OR
        (owner_user IS NULL AND merchant_id IS NOT NULL)
    )
);

-- Journal entries (transaction metadata)
CREATE TABLE IF NOT EXISTS app.wallet_journal (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ref TEXT UNIQUE NOT NULL, -- Idempotency key
    op TEXT NOT NULL CHECK (op IN ('mint', 'buy', 'transfer', 'spend', 'burn')),
    memo TEXT,
    initiated_by UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger entries (double-entry accounting)
CREATE TABLE IF NOT EXISTS app.wallet_entries (
    id BIGSERIAL PRIMARY KEY,
    journal_id BIGINT NOT NULL REFERENCES app.wallet_journal(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES app.wallet_accounts(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) NOT NULL, -- Positive = credit, Negative = debit
    currency TEXT NOT NULL DEFAULT 'USDt',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Balance view (aggregated from entries)
CREATE OR REPLACE VIEW app.wallet_balances AS
SELECT 
    account_id,
    currency,
    COALESCE(SUM(amount), 0) as balance,
    COUNT(*) as entry_count,
    MAX(created_at) as last_transaction_at
FROM app.wallet_entries
GROUP BY account_id, currency;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS wallet_accounts_owner_idx ON app.wallet_accounts(owner_user);
CREATE INDEX IF NOT EXISTS wallet_accounts_merchant_idx ON app.wallet_accounts(merchant_id);
CREATE INDEX IF NOT EXISTS wallet_journal_ref_idx ON app.wallet_journal(ref);
CREATE INDEX IF NOT EXISTS wallet_journal_ts_idx ON app.wallet_journal(ts DESC);
CREATE INDEX IF NOT EXISTS wallet_entries_journal_idx ON app.wallet_entries(journal_id);
CREATE INDEX IF NOT EXISTS wallet_entries_account_idx ON app.wallet_entries(account_id);
CREATE INDEX IF NOT EXISTS wallet_entries_created_idx ON app.wallet_entries(created_at DESC);

-- ============================================================
-- WALLET CONSTRAINTS & VALIDATION
-- ============================================================

-- Enforce balanced journal entries (sum of amounts = 0)
CREATE OR REPLACE FUNCTION app.enforce_balanced_journal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    journal_sum NUMERIC(18,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO journal_sum
    FROM app.wallet_entries
    WHERE journal_id = NEW.journal_id;
    
    IF journal_sum <> 0 THEN
        RAISE EXCEPTION 'Unbalanced journal %. Sum: %', NEW.journal_id, journal_sum;
    END IF;
    
    RETURN NEW;
END $$;

-- Trigger after entries are inserted
CREATE TRIGGER trg_wallet_entries_balanced
AFTER INSERT ON app.wallet_entries
FOR EACH ROW
EXECUTE FUNCTION app.enforce_balanced_journal();

-- Prevent negative balances
CREATE OR REPLACE FUNCTION app.check_wallet_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    current_balance NUMERIC(18,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM app.wallet_entries
    WHERE account_id = NEW.account_id AND currency = NEW.currency;
    
    IF current_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient balance in account %. Balance: %', NEW.account_id, current_balance;
    END IF;
    
    RETURN NEW;
END $$;

CREATE TRIGGER trg_wallet_entries_non_negative
AFTER INSERT ON app.wallet_entries
FOR EACH ROW
EXECUTE FUNCTION app.check_wallet_balance();

-- ============================================================
-- VISITOR CHECK-IN SYSTEM
-- ============================================================

-- Offices/kiosks for visitor registration
CREATE TABLE IF NOT EXISTS app.visitor_offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sacco_id UUID REFERENCES app.saccos(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    nfc_token TEXT UNIQUE, -- Short-lived token for NFC tap
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Visitor check-ins
CREATE TABLE IF NOT EXISTS app.visitor_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES app.visitor_offices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id), -- May be NULL for anonymous visitors
    visitor_name TEXT,
    visitor_phone TEXT,
    visitor_id_type TEXT, -- 'NID', 'PASSPORT', etc.
    visitor_id_number TEXT,
    purpose TEXT,
    device_fingerprint JSONB,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_out_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS visitor_offices_sacco_idx ON app.visitor_offices(sacco_id);
CREATE INDEX IF NOT EXISTS visitor_offices_token_idx ON app.visitor_offices(nfc_token) WHERE nfc_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS visitor_checkins_office_idx ON app.visitor_checkins(office_id);
CREATE INDEX IF NOT EXISTS visitor_checkins_user_idx ON app.visitor_checkins(user_id);
CREATE INDEX IF NOT EXISTS visitor_checkins_date_idx ON app.visitor_checkins(checked_in_at DESC);

-- ============================================================
-- WALLET OPERATIONS (Server-Authoritative)
-- ============================================================

-- Transfer tokens between accounts
CREATE OR REPLACE FUNCTION app.wallet_transfer(
    p_from_account UUID,
    p_to_account UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_journal_id BIGINT;
    v_ref TEXT;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be positive';
    END IF;
    
    -- Generate or use provided idempotency key
    v_ref := COALESCE(p_idempotency_key, 'transfer-' || gen_random_uuid()::TEXT);
    
    -- Create journal entry
    INSERT INTO app.wallet_journal (ref, op, memo, initiated_by)
    VALUES (v_ref, 'transfer', p_memo, auth.uid())
    RETURNING id INTO v_journal_id;
    
    -- Debit from sender
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_from_account, -p_amount, p_currency);
    
    -- Credit to receiver
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_to_account, p_amount, p_currency);
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buy tokens with MoMo top-up (linked to payment)
CREATE OR REPLACE FUNCTION app.wallet_buy_tokens(
    p_account_id UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_payment_id UUID DEFAULT NULL,
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_journal_id BIGINT;
    v_ref TEXT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Buy amount must be positive';
    END IF;
    
    v_ref := COALESCE(p_idempotency_key, 'buy-' || gen_random_uuid()::TEXT);
    
    -- Create journal entry
    INSERT INTO app.wallet_journal (ref, op, memo, initiated_by, metadata)
    VALUES (v_ref, 'buy', p_memo, auth.uid(), 
            jsonb_build_object('payment_id', p_payment_id))
    RETURNING id INTO v_journal_id;
    
    -- Credit user account (from system/SACCO reserve)
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_account_id, p_amount, p_currency);
    
    -- Debit is implicit (external MoMo payment, not tracked in ledger)
    -- Or could debit a system reserve account if needed
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mint tokens (promotional credits, admin only)
CREATE OR REPLACE FUNCTION app.wallet_mint_tokens(
    p_account_id UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_journal_id BIGINT;
    v_ref TEXT;
    v_is_admin BOOLEAN;
BEGIN
    -- Check if caller is admin
    SELECT EXISTS (
        SELECT 1 FROM app.staff_profiles
        WHERE user_id = auth.uid() AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only admins can mint tokens';
    END IF;
    
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Mint amount must be positive';
    END IF;
    
    v_ref := COALESCE(p_idempotency_key, 'mint-' || gen_random_uuid()::TEXT);
    
    INSERT INTO app.wallet_journal (ref, op, memo, initiated_by)
    VALUES (v_ref, 'mint', p_memo, auth.uid())
    RETURNING id INTO v_journal_id;
    
    -- Credit user account (from thin air)
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_account_id, p_amount, p_currency);
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Burn tokens (withdraw to MoMo)
CREATE OR REPLACE FUNCTION app.wallet_burn_tokens(
    p_account_id UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_momo_txn_id TEXT DEFAULT NULL,
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_journal_id BIGINT;
    v_ref TEXT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Burn amount must be positive';
    END IF;
    
    v_ref := COALESCE(p_idempotency_key, 'burn-' || gen_random_uuid()::TEXT);
    
    INSERT INTO app.wallet_journal (ref, op, memo, initiated_by, metadata)
    VALUES (v_ref, 'burn', p_memo, auth.uid(),
            jsonb_build_object('momo_txn_id', p_momo_txn_id))
    RETURNING id INTO v_journal_id;
    
    -- Debit user account
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_account_id, -p_amount, p_currency);
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Spend tokens at merchant
CREATE OR REPLACE FUNCTION app.wallet_spend_tokens(
    p_payer_account UUID,
    p_merchant_account UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
BEGIN
    -- Use transfer function (same mechanics)
    RETURN app.wallet_transfer(
        p_payer_account,
        p_merchant_account,
        p_amount,
        p_currency,
        p_memo,
        p_idempotency_key
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE app.wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.wallet_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.visitor_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.visitor_checkins ENABLE ROW LEVEL SECURITY;

-- Wallet accounts: users can see their own accounts
CREATE POLICY wallet_accounts_select_policy ON app.wallet_accounts
    FOR SELECT
    USING (owner_user = auth.uid());

-- Wallet accounts: users can insert their own accounts (one-time setup)
CREATE POLICY wallet_accounts_insert_policy ON app.wallet_accounts
    FOR INSERT
    WITH CHECK (owner_user = auth.uid());

-- Wallet journal: users can see their own transactions
CREATE POLICY wallet_journal_select_policy ON app.wallet_journal
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.wallet_entries we
            JOIN app.wallet_accounts wa ON we.account_id = wa.id
            WHERE we.journal_id = wallet_journal.id
                AND wa.owner_user = auth.uid()
        )
    );

-- Wallet entries: users can see entries for their accounts
CREATE POLICY wallet_entries_select_policy ON app.wallet_entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.wallet_accounts wa
            WHERE wa.id = wallet_entries.account_id
                AND wa.owner_user = auth.uid()
        )
    );

-- Visitor offices: staff can view offices for their SACCO
CREATE POLICY visitor_offices_select_policy ON app.visitor_offices
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND (sp.sacco_id = visitor_offices.sacco_id OR sp.role = 'admin')
        )
    );

-- Visitor offices: admin staff can manage offices
CREATE POLICY visitor_offices_manage_policy ON app.visitor_offices
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = visitor_offices.sacco_id
                AND sp.role IN ('admin', 'manager')
        )
    );

-- Visitor check-ins: users can see their own check-ins
CREATE POLICY visitor_checkins_user_select_policy ON app.visitor_checkins
    FOR SELECT
    USING (user_id = auth.uid());

-- Visitor check-ins: staff can view check-ins for their SACCO
CREATE POLICY visitor_checkins_staff_select_policy ON app.visitor_checkins
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            JOIN app.visitor_offices vo ON vo.sacco_id = sp.sacco_id
            WHERE sp.user_id = auth.uid()
                AND vo.id = visitor_checkins.office_id
                AND (sp.sacco_id = vo.sacco_id OR sp.role = 'admin')
        )
    );

-- Visitor check-ins: anyone can insert (public kiosk)
CREATE POLICY visitor_checkins_insert_policy ON app.visitor_checkins
    FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT, INSERT ON app.wallet_accounts TO authenticated;
GRANT SELECT ON app.wallet_journal TO authenticated;
GRANT SELECT ON app.wallet_entries TO authenticated;
GRANT SELECT ON app.wallet_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app.visitor_offices TO authenticated;
GRANT SELECT, INSERT ON app.visitor_checkins TO authenticated;

GRANT EXECUTE ON FUNCTION app.wallet_transfer(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app.wallet_buy_tokens(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app.wallet_mint_tokens(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app.wallet_burn_tokens(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app.wallet_spend_tokens(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER wallet_accounts_updated_at
    BEFORE UPDATE ON app.wallet_accounts
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

CREATE TRIGGER visitor_offices_updated_at
    BEFORE UPDATE ON app.visitor_offices
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE app.wallet_accounts IS 'Token wallet accounts for users and merchants';
COMMENT ON TABLE app.wallet_journal IS 'Transaction journal for wallet operations (double-entry)';
COMMENT ON TABLE app.wallet_entries IS 'Ledger entries for wallet transactions';
COMMENT ON VIEW app.wallet_balances IS 'Aggregated wallet balances by account and currency';
COMMENT ON TABLE app.visitor_offices IS 'Office/kiosk locations for NFC visitor check-in';
COMMENT ON TABLE app.visitor_checkins IS 'Visitor check-in records';
COMMENT ON FUNCTION app.wallet_transfer(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) IS 'Transfer tokens between accounts';
COMMENT ON FUNCTION app.wallet_buy_tokens(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT) IS 'Buy tokens with MoMo payment';
COMMENT ON FUNCTION app.wallet_mint_tokens(UUID, NUMERIC, TEXT, TEXT, TEXT) IS 'Mint promotional tokens (admin only)';
COMMENT ON FUNCTION app.wallet_burn_tokens(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) IS 'Burn tokens and withdraw to MoMo';
COMMENT ON FUNCTION app.wallet_spend_tokens(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) IS 'Spend tokens at merchant';
